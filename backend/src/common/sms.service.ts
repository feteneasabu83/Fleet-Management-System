import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import axios from "axios"

/**
 * Ethiopian SMS gateway integration (Ethio Telecom / Safaricom delivery).
 *
 * Supported providers via SMS_PROVIDER env var:
 *
 *   afromessage
 *     POST {SMS_API_URL}/send
 *     Auth: Authorization: Bearer <SMS_API_KEY>
 *     Body: { to: "2519XXXXXXXX", message: "...", sender: "<SMS_SENDER_ID>" }
 *     Docs: https://afromessage.com/docs
 *
 *   smshub
 *     POST {SMS_API_URL}/api/sms   (default base https://smshub.et)
 *     Auth: Authorization: Bearer <SMS_API_KEY>
 *     Body: { msisdn: "09XXXXXXXX", text: "..." }
 *     Docs: https://smshub.et/docs
 *
 *   generic
 *     POST {SMS_API_URL}
 *     Auth: Authorization: Bearer <SMS_API_KEY>
 *     Body: { to: "2519XXXXXXXX", message: "...", senderId: "<SMS_SENDER_ID>" }
 *
 * Environment variables:
 *   SMS_ENABLED=true|false   (default false -> messages are only logged)
 *   SMS_PROVIDER=afromessage|smshub|generic
 *   SMS_API_URL=...          (provider base URL; optional for smshub)
 *   SMS_API_KEY=...          (API token / secret key)
 *   SMS_SENDER_ID=...        (registered sender ID, e.g. "FCSC")
 *   SMS_TIMEOUT_MS=10000
 *
 * Phone numbers are taken from User.phone (captured at registration).
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

  private get provider(): string {
    return (this.config.get<string>("SMS_PROVIDER") || "generic").toLowerCase()
  }

  private get apiUrl(): string | undefined {
    const url = this.config.get<string>("SMS_API_URL")
    if (url) return url.replace(/\/+$/, "")
    if (this.provider === "smshub") return "https://smshub.et"
    return undefined
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

  /** Normalize to international digits: 2519XXXXXXXX */
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

  /** Normalize to local Ethiopian format: 09XXXXXXXX */
  private normalizePhoneLocal(raw?: string | null): string | null {
    const intl = this.normalizePhone(raw)
    if (!intl) return null
    return "0" + intl.slice(3) // 2519XXXXXXXX -> 09XXXXXXXX
  }

  /** Send a single SMS. Returns true when the gateway accepted the request. */
  async sendSms(to: string | null | undefined, message: string): Promise<boolean> {
    const intl = this.normalizePhone(to)
    if (!intl) {
      this.logger.warn(`SMS skipped: invalid/missing phone for message "${message.slice(0, 60)}"`)
      return false
    }

    if (!this.enabled || !this.apiUrl || !this.apiKey) {
      this.logger.log(`[SMS disabled] to=${intl} msg="${message}"`)
      return false
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      }

      let response: any
      switch (this.provider) {
        case "afromessage": {
          // AfroMessage: POST {base}/send with { to, message, sender }
          response = await axios.post(
            `${this.apiUrl}/send`,
            {
              to: intl,
              message,
              sender: this.senderId,
            },
            { headers, timeout: this.timeoutMs },
          )
          break
        }
        case "smshub": {
          // SMSHub: POST {base}/api/sms with { msisdn (local format), text }
          const local = this.normalizePhoneLocal(to) || intl
          response = await axios.post(
            `${this.apiUrl}/api/sms`,
            { msisdn: local, text: message },
            { headers, timeout: this.timeoutMs },
          )
          break
        }
        default: {
          // Generic JSON gateway
          response = await axios.post(
            this.apiUrl,
            { to: intl, message, senderId: this.senderId },
            { headers, timeout: this.timeoutMs },
          )
        }
      }

      const ack = response?.data?.acknowledge || response?.data?.message_status || "ok"
      if (ack === "error" || ack === "failed") {
        this.logger.error(`SMS rejected by gateway for ${intl}: ${JSON.stringify(response?.data)}`)
        return false
      }

      this.logger.log(`SMS sent to ${intl} via ${this.provider}`)
      return true
    } catch (err: any) {
      this.logger.error(
        `SMS failed to ${intl}: ${err?.response?.status ?? ""} ${err?.message ?? err}`,
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
