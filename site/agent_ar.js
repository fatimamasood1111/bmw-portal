/* Arabic -> English keyword bridge for Wazir. The small local model (qwen2.5:3b) is unreliable at tool-calling in Arabic, so common
   Arabic car terms are converted to English before the message reaches the model; the chat still shows the customer's Arabic and the
   system prompt tells Wazir to answer in Arabic. */
window.arToEn = function (text) {
  let s = " " + String(text).replace(/[ً-ٟـ]/g, "").replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x6f0)
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه") + " ";
  const W = [
    ["افضل الصفقات", "best deals"], ["افضل صفقه", "best deal"], ["ارخص", "cheaper"], ["باقل من", "under"], ["اقل من", "under"], ["اكثر من", "over"], ["لا تزيد عن", "under"], ["حتي", "up to"], ["ميزانيتي", "budget"], ["ميزانيه", "budget"],
    ["تجربه القياده", "test drive"], ["تجربه قياده", "test drive"], ["احجز", "book"], ["حجز", "book"], ["ارغب في", "I would like to"], ["اريد", "I want"], ["ابحث عن", "I am looking for"], ["ارني", "show me"], ["اعرض", "show me"], ["قارن", "compare"], ["قارنها", "compare it"],
    ["هذه السياره", "this car"], ["سياراتكم", "your cars"], ["سياره", "car"], ["سيارات", "cars"], ["عائليه", "family"], ["للعائله", "for the family"], ["عائله", "family"], ["هجينه", "hybrid"], ["هجين", "hybrid"], ["كهربائيه", "electric"], ["كهربائي", "electric"], ["بنزين", "petrol"],
    ["رياضيه", "sporty and fast"], ["سريعه", "fast"], ["اقتصاديه", "fuel-efficient"], ["مقاعد", "seats"], ["مقعد", "seat"], ["الصفقات", "deals"], ["السعر", "price"], ["سعر", "price"], ["جيد", "good"], ["درهم", "AED"], ["حصان", "hp"], ["تويوتا", "Toyota"], ["نيسان", "Nissan"], ["هوندا", "Honda"], ["مازدا", "Mazda"],
    ["هيونداي", "Hyundai"], ["هيوندا", "Hyundai"], ["كيا", "Kia"], ["مرسيدس", "Mercedes-Benz"], ["اودي", "Audi"], ["بي ام دبليو", "BMW"], ["بي ام", "BMW"], ["لكزس", "Lexus"], ["بورش", "Porsche"], ["لاند روفر", "Land Rover"], ["رينج روفر", "Range Rover"], ["تيسلا", "Tesla"], ["فورد", "Ford"], ["جيب", "Jeep"],
    ["فولكس فاجن", "Volkswagen"], ["فولكسفاجن", "Volkswagen"], ["سيدان", "sedan"], ["دفع رباعي", "SUV"], ["هاتشباك", "hatchback"], ["كوبيه", "coupe"], ["فان", "van"],
    ["غدا", "tomorrow"], ["اليوم", "today"], ["الاثنين", "Monday"], ["الثلاثاء", "Tuesday"], ["الاربعاء", "Wednesday"], ["الخميس", "Thursday"], ["الجمعه", "Friday"], ["السبت", "Saturday"], ["الاحد", "Sunday"],
    ["سبعه", "7"], ["سبع", "7"], ["ثمانيه", "8"], ["ثمان", "8"], ["خمسه", "5"], ["خمس", "5"], ["سته", "6"], ["ست", "6"], ["اربعه", "4"], ["اربع", "4"], ["ثلاثه", "3"], ["اثنين", "2"],
  ];
  for (const [ar, en] of W) s = s.split(ar).join(en);
  s = s.replace(/ب(\d)/g, "$1").replace(/(\d{1,2})\s*(?:م|مساء|عصرا|ظهرا|مساءا)\b/g, "$1pm").replace(/(\d{1,2})\s*(?:ص|صباحا)\b/g, "$1am");
  return s.replace(/\s+/g, " ").trim() || String(text);
};
