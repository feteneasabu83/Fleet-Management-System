import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import axios from "axios"

/**
 * Generic SMS gateway integration.
 *
 * Configure via environment variables:
 *   SMS_ENABLED=true|false        (default: false -> messages are only logged)
 *   SMS_API_URL=https://...       (gateway endpoint that accepts POST JSON)
 *   SMS_API_KEY=...               (sent as `Authorization: Bearer <key>`)
 *   SMS_SENDER_ID=...             (optional sender id / originator)
 *   SMS_TIMEOUT_MS=10000          (optional, default 10000)
 *
 * Expected request body sent to SMS_API_URL:
 *   { "to": "2519XXXXXXXX", "message": "...", "senderId": "..." }
 *
 * The service never throws — SMS failures are logged and swallowed so they
 * cannot break the main fleet workflow.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)

  constructor(private readonly config: ConfigService) {}

  private get enabled(): boolean {
    return (this.config.get<string>("SMS_ENABLED") || "").toLowerCase() === "true"
  }

  private get apiUrl(): string | undefined {
    return this.config.get<string>("SMS_API_URL") || undefined
  }

  private get apiKey(): string | undefined {
    return this.config.get<string>("SMS_API_KEY") || undefined
  }

  private get senderId(): string | undefined {
    return this.config.get<string>("SMS_SENDER_ID") || undefined
  }

  private get timeoutMs(): number {
    const v = Number(this.config.get<string>("SMS_TIMEOUT_MS"))
    return Number.isFinite(v) && v > 0 ? v : 10000
  }

  /** Normalize Ethiopian phone numbers to international digits (2519XXXXXXXX). */
  normalizePhone(raw?: string | null): string | null {
    if (!raw) return null
    let digits = String(raw).replace(/\D/g, "")
    if (!digits) return null
    if (digits.startsWith("00251")) digits = digits.slice(2)
    if (digits.startsWith("0")) digits = "251" + digits.slice(1)
    if (digits.startsWith("9") && digits.length === 9) digits = "251" + digits
    if (!digits.startsWith("251")) return null
    return digits
  }

  /** Send a single SMS. Returns true when the gateway accepted the request. */
  async sendSms(to: string | null | undefined, message: string): Promise<boolean> {
    const phone = this.normalizePhone(to)
    if (!phone) {
      this.logger.warn(`SMS skipped: invalid/missing phone for message "${message.slice(0, 60)}"`)
      return false
    }

    if (!this.enabled || !this.apiUrl) {
      this.logger.log(`[SMS disabled] to=${phone} msg="${message}"`)
      return false
    }

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`

      await axios.post(
        this.apiUrl,
        { to: phone, message, senderId: this.senderId },
        { headers, timeout: this.timeoutMs },
      )
      this.logger.log(`SMS sent to ${phone}`)
      return true
    } catch (err: any) {
      this.logger.error(
        `SMS failed to ${phone}: ${err?.response?.status ?? ""} ${err?.message ?? err}`,
      )
      return false
    }
  }

  /** Send the same SMS to a list of phone numbers (deduplicated). */
  async sendSmsToMany(recipients: (string | null | undefined)[], message: string): Promise<void> {
    const unique = Array.from(
      new Set(recipients.map((r) => this.normalizePhone(r)).filter((p): p is string => !!p)),
    )
    await Promise.all(unique.map((p) => this.sendSms(p, message)))
  }
}
