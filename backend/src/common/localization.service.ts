import { Injectable } from "@nestjs/common"
import { Language } from "@prisma/client"

interface TranslationMap {
  [key: string]: {
    [Language.EN]: string
    [Language.AM]: string
    [Language.OR]: string
    [Language.TI]: string
    [Language.SO]: string
    [Language.SI]: string
    [Language.WO]: string
  }
}

@Injectable()
export class LocalizationService {
  private translations: TranslationMap = {
    // Common terms
    "common.yes": {
      [Language.EN]: "Yes",
      [Language.AM]: "አዎ",
      [Language.OR]: "Eeyyee",
      [Language.TI]: "እወ",
      [Language.SO]: "Haa",
      [Language.SI]: "Haa",
      [Language.WO]: "Waaw",
    },
    "common.no": {
      [Language.EN]: "No",
      [Language.AM]: "አይ",
      [Language.OR]: "Lakki",
      [Language.TI]: "አይ",
      [Language.SO]: "Maya",
      [Language.SI]: "Maya",
      [Language.WO]: "Déedet",
    },
    "common.save": {
      [Language.EN]: "Save",
      [Language.AM]: "አስቀምጥ",
      [Language.OR]: "Olkaa'i",
      [Language.TI]: "ኣቐምጥ",
      [Language.SO]: "Kaydi",
      [Language.SI]: "Kaydi",
      [Language.WO]: "Dakk",
    },
    "common.cancel": {
      [Language.EN]: "Cancel",
      [Language.AM]: "ሰርዝ",
      [Language.OR]: "Dhiisi",
      [Language.TI]: "ሰርዝ",
      [Language.SO]: "Jooji",
      [Language.SI]: "Jooji",
      [Language.WO]: "Neenal",
    },
    "common.delete": {
      [Language.EN]: "Delete",
      [Language.AM]: "ሰርዝ",
      [Language.OR]: "Balleessi",
      [Language.TI]: "ደምስስ",
      [Language.SO]: "Tirtir",
      [Language.SI]: "Tirtir",
      [Language.WO]: "Far",
    },
    "common.edit": {
      [Language.EN]: "Edit",
      [Language.AM]: "አርም",
      [Language.OR]: "Gulali",
      [Language.TI]: "ኣርም",
      [Language.SO]: "Wax ka beddel",
      [Language.SI]: "Wax ka beddel",
      [Language.WO]: "Soppi",
    },
    "common.create": {
      [Language.EN]: "Create",
      [Language.AM]: "ፍጠር",
      [Language.OR]: "Uumi",
      [Language.TI]: "ፍጠር",
      [Language.SO]: "Samee",
      [Language.SI]: "Samee",
      [Language.WO]: "Sos",
    },
    "common.search": {
      [Language.EN]: "Search",
      [Language.AM]: "ፈልግ",
      [Language.OR]: "Barbaadi",
      [Language.TI]: "ደልይ",
      [Language.SO]: "Raadi",
      [Language.SI]: "Raadi",
      [Language.WO]: "Ceet",
    },

    // User roles
    "role.general_director": {
      [Language.EN]: "General Director",
      [Language.AM]: "ዋና ዳይሬክተር",
      [Language.OR]: "Daayireektara Waliigalaa",
      [Language.TI]: "ሓፈሻዊ ዳይረክተር",
      [Language.SO]: "Agaasime Guud",
      [Language.SI]: "Agaasime Guud",
      [Language.WO]: "Direktëru bu Mag",
    },
    "role.staff_manager": {
      [Language.EN]: "Staff Manager",
      [Language.AM]: "የሰራተኞች አስተዳዳሪ",
      [Language.OR]: "Bulchaa Hojjettootaa",
      [Language.TI]: "ኣመሓዳሪ ሰራሕተኛታት",
      [Language.SO]: "Maamulaha Shaqaalaha",
      [Language.SI]: "Maamulaha Shaqaalaha",
      [Language.WO]: "Boroom Liggéey",
    },
    "role.admin": {
      [Language.EN]: "Administrator",
      [Language.AM]: "አስተዳዳሪ",
      [Language.OR]: "Bulchaa",
      [Language.TI]: "ኣመሓዳሪ",
      [Language.SO]: "Maamule",
      [Language.SI]: "Maamule",
      [Language.WO]: "Boroom",
    },
    "role.support_agent": {
      [Language.EN]: "Support Agent",
      [Language.AM]: "የድጋፍ ወኪል",
      [Language.OR]: "Bakka bu'aa Deeggaraa",
      [Language.TI]: "ወኪል ደገፍ",
      [Language.SO]: "Wakiilka Taageerada",
      [Language.SI]: "Wakiilka Taageerada",
      [Language.WO]: "Wakiilu Wallante",
    },
    "role.end_user": {
      [Language.EN]: "End User",
      [Language.AM]: "የመጨረሻ ተጠቃሚ",
      [Language.OR]: "Fayyadamaa Dhumaa",
      [Language.TI]: "ናይ መወዳእታ ተጠቃሚ",
      [Language.SO]: "Isticmaale Dhammaad",
      [Language.SI]: "Isticmaale Dhammaad",
      [Language.WO]: "Jëfandikukat bu mujj",
    },

    // Notifications
    "notification.welcome": {
      [Language.EN]: "Welcome to Ethiopian Civil Service Commission Asset Management System",
      [Language.AM]: "ወደ የኢትዮጵያ ሲቪል ሰርቪስ ኮሚሽን የንብረት አስተዳደር ስርዓት እንኳን በደህና መጡ",
      [Language.OR]: "Gara Desk Gargaarsa Komishina Tajaajila Siviilii Itoophiyaatti baga nagaan dhuftan",
      [Language.TI]: "ናብ ሓገዝ ዴስክ ኮሚሽን ሲቪል ሰርቪስ ኢትዮጵያ እንቋዕ ብደሓን መጻእኩም",
      [Language.SO]: "Ku soo dhawoow Miiska Caawinta Guddiga Adeegga Madaniga Itoobiya",
      [Language.SI]: "Ku soo dhawoow Miiska Caawinta Guddiga Adeegga Madaniga Itoobiya",
      [Language.WO]: "Dalal ak jamm ci biro caaw bu Komise yu Sërvisu Siviil yu Ecoopi",
    },
  }

  translate(key: string, language: Language = Language.EN, params?: Record<string, string>): string {
    const translation = this.translations[key]

    if (!translation) {
      console.warn(`Translation not found for key: ${key}`)
      return key
    }

    let text = translation[language] || translation[Language.EN] || key

    // Replace parameters
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        text = text.replace(new RegExp(`{{${param}}}`, "g"), value)
      })
    }

    return text
  }

  getAvailableLanguages(): Language[] {
    return Object.values(Language)
  }

  getLanguageName(language: Language): string {
    const names = {
      [Language.EN]: "English",
      [Language.AM]: "አማርኛ (Amharic)",
      [Language.OR]: "Afaan Oromoo (Oromo)",
      [Language.TI]: "ትግርኛ (Tigrinya)",
      [Language.SO]: "Soomaali (Somali)",
      [Language.SI]: "Sidaamu Afoo (Sidama)",
      [Language.WO]: "Wolof",
    }

    return names[language] || language
  }

  detectLanguageFromText(text: string): Language {
    // Simple language detection based on character patterns
    // This is a basic implementation - in production, you might want to use a proper language detection library

    // Check for Amharic characters
    if (/[\u1200-\u137F]/.test(text)) {
      return Language.AM
    }

    // Check for Arabic script (Somali can use Arabic script)
    if (/[\u0600-\u06FF]/.test(text)) {
      return Language.SO
    }

    // Default to English
    return Language.EN
  }

  formatDate(date: Date, language: Language = Language.EN): string {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    }

    const locales = {
      [Language.EN]: "en-US",
      [Language.AM]: "am-ET",
      [Language.OR]: "om-ET",
      [Language.TI]: "ti-ET",
      [Language.SO]: "so-ET",
      [Language.SI]: "sid-ET",
      [Language.WO]: "wo-SN",
    }

    try {
      return new Intl.DateTimeFormat(locales[language] || "en-US", options).format(date)
    } catch (error) {
      // Fallback to English if locale is not supported
      return new Intl.DateTimeFormat("en-US", options).format(date)
    }
  }

  formatNumber(number: number, language: Language = Language.EN): string {
    const locales = {
      [Language.EN]: "en-US",
      [Language.AM]: "am-ET",
      [Language.OR]: "om-ET",
      [Language.TI]: "ti-ET",
      [Language.SO]: "so-ET",
      [Language.SI]: "sid-ET",
      [Language.WO]: "wo-SN",
    }

    try {
      return new Intl.NumberFormat(locales[language] || "en-US").format(number)
    } catch (error) {
      // Fallback to English if locale is not supported
      return new Intl.NumberFormat("en-US").format(number)
    }
  }

  getTextDirection(language: Language): "ltr" | "rtl" {
    // Most Ethiopian languages use left-to-right text direction
    // Arabic script languages would use right-to-left
    return "ltr"
  }
}
