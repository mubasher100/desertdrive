/**
 * Third-party imagery in use, for the /credits page. Every CC BY / BY-SA image
 * on the site MUST be listed here; that page is how the attribution condition
 * of the licence is met.
 *
 * When the owner's own photography replaces a placeholder, delete its row.
 */
export type Credit = {
  /** What it is used for, in plain words. */
  subject: string
  title: string
  author: string
  licence: string
  licenceUrl: string
  source: string
  /**
   * Background removed and the car set on a plain backdrop, as well as
   * cropped. CC BY-SA requires saying the work was changed, and this is a
   * bigger change than a crop, so it is said specifically.
   */
  modified?: boolean
}

export const CREDITS: Credit[] = [
  { subject: "sedan", title: "TOYOTA COROLLA SEDAN (E210) China (12).jpg", author: "Dinkun Chen", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:TOYOTA_COROLLA_SEDAN_(E210)_China_(12).jpg", modified: true },
  { subject: "suv", title: "2018 Toyota Rush 1.5 S.jpg", author: "Aaront1059", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:2018_Toyota_Rush_1.5_S.jpg", modified: true },
  { subject: "large-van", title: "Toyota Hiace Commuter Deluxe 2020 (cropped).jpg", author: "Captainmorlypogi1959", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:Toyota_Hiace_Commuter_Deluxe_2020_(cropped).jpg", modified: true },
  { subject: "luxury-van", title: "MERCEDES BENZ V-CLASS (W447) China (13).jpg", author: "Dinkun Chen", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:MERCEDES_BENZ_V-CLASS_(W447)_China_(13).jpg", modified: true },
  { subject: "luxury-sedan", title: "MERCEDES-BENZ S-CLASS (W223) China (10).jpg", author: "Dinkun Chen", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:MERCEDES-BENZ_S-CLASS_(W223)_China_(10).jpg", modified: true },
  { subject: "hero", title: "Doha Corniche Skyline View 2", author: "Zairon", licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/", source: "https://commons.wikimedia.org/wiki/File:Doha_Corniche_Skyline_View_2.jpg" },
  { subject: "toyota-rush", title: "2019 Toyota Rush 1.5 TRD Sportivo (front), Ciater, Subang.jpg", author: "Alex Neman", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:2019_Toyota_Rush_1.5_TRD_Sportivo_(front),_Ciater,_Subang.jpg" },
  { subject: "toyota-hiace", title: "Toyota Hiace Commuter Deluxe 2020.jpg", author: "Captainmorlypogi1959", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:Toyota_Hiace_Commuter_Deluxe_2020.jpg" },
  { subject: "hyundai-h1", title: "Hyundai Grand Starex VIP front.jpg", author: "M.rJirapat", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:Hyundai_Grand_Starex_VIP_front.jpg" },
  { subject: "tesla-model-3", title: "Tesla Model 3 white (1).jpg", author: "Damian B Oh", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:Tesla_Model_3_white_(1).jpg" },
  { subject: "mpv", title: "2022 Kia Carnival LXS, Front Left, 05-24-2021.jpg", author: "SsmIntrigue", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:2022_Kia_Carnival_LXS,_Front_Left,_05-24-2021.jpg" },
]
