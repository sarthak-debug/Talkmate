// Built-in practice content. Works offline and costs nothing.
// The app adds fresh AI-made questions on top of these when you ask for them.

export const BUILDER = [
  "I am going to the market", "She has been working here for two years",
  "Could you please help me with this", "We went to the beach last Sunday",
  "He does not like spicy food", "My brother is taller than me",
  "I will call you after the meeting", "They have already finished their homework",
  "What time does the train leave", "I have never been to Delhi",
  "Please turn off the lights before you leave", "She is good at playing the guitar",
  "It was raining when I reached home", "How long have you lived in Mumbai",
  "I usually drink tea in the morning", "Can I pay by card here",
];

export const SPOT = [
  { wrong: "She don't like coffee.", right: "She doesn't like coffee.", why: "With he, she or it, use 'doesn't'." },
  { wrong: "I am agree with you.", right: "I agree with you.", why: "'Agree' is a verb, so don't add 'am'." },
  { wrong: "I am waiting since morning.", right: "I have been waiting since morning.", why: "With 'since', use 'have been + -ing'." },
  { wrong: "Yesterday I go to school.", right: "Yesterday I went to school.", why: "'Yesterday' needs the past tense." },
  { wrong: "She is more taller than me.", right: "She is taller than me.", why: "'Taller' already means 'more tall'." },
  { wrong: "Let's discuss about the plan.", right: "Let's discuss the plan.", why: "'Discuss' doesn't need 'about'." },
  { wrong: "He gave me an advice.", right: "He gave me some advice.", why: "'Advice' can't be counted, so no 'an'." },
  { wrong: "I am having two brothers.", right: "I have two brothers.", why: "For owning or family, use 'have', not 'am having'." },
  { wrong: "Where you are going?", right: "Where are you going?", why: "In questions, 'are' comes before 'you'." },
  { wrong: "My all friends came.", right: "All my friends came.", why: "Say 'all my', not 'my all'." },
  { wrong: "She returned back home.", right: "She returned home.", why: "'Returned' already means 'came back'." },
  { wrong: "I did not went there.", right: "I did not go there.", why: "After 'did not', use the base verb." },
  { wrong: "He is senior than me.", right: "He is senior to me.", why: "We say 'senior to', not 'senior than'." },
  { wrong: "Please revert back soon.", right: "Please reply soon.", why: "'Revert' means go back; use 'reply'." },
  { wrong: "One of my friend is a doctor.", right: "One of my friends is a doctor.", why: "After 'one of my', use a plural noun." },
  { wrong: "I have passed out from college in 2020.", right: "I graduated from college in 2020.", why: "'Pass out' means to faint; say 'graduated'." },
];

export const WORDS = [
  { word: "beautiful", hi: "सुंदर", mr: "सुंदर" },
  { word: "necessary", hi: "आवश्यक", mr: "आवश्यक" },
  { word: "environment", hi: "पर्यावरण", mr: "पर्यावरण" },
  { word: "tomorrow", hi: "आने वाला कल", mr: "उद्या" },
  { word: "vegetable", hi: "सब्ज़ी", mr: "भाजी" },
  { word: "neighbour", hi: "पड़ोसी", mr: "शेजारी" },
  { word: "library", hi: "पुस्तकालय", mr: "ग्रंथालय" },
  { word: "knowledge", hi: "ज्ञान", mr: "ज्ञान" },
  { word: "experience", hi: "अनुभव", mr: "अनुभव" },
  { word: "weather", hi: "मौसम", mr: "हवामान" },
  { word: "different", hi: "अलग", mr: "वेगळा" },
  { word: "friendship", hi: "दोस्ती", mr: "मैत्री" },
  { word: "important", hi: "महत्वपूर्ण", mr: "महत्त्वाचा" },
  { word: "kitchen", hi: "रसोई", mr: "स्वयंपाकघर" },
  { word: "festival", hi: "त्योहार", mr: "सण" },
  { word: "question", hi: "सवाल", mr: "प्रश्न" },
  { word: "answer", hi: "जवाब", mr: "उत्तर" },
  { word: "morning", hi: "सुबह", mr: "सकाळ" },
  { word: "hospital", hi: "अस्पताल", mr: "रुग्णालय" },
  { word: "business", hi: "व्यापार", mr: "व्यवसाय" },
];

export const TRANSLATE = {
  hi: [
    { native: "मैं रोज़ सुबह चाय पीता हूँ।", roman: "Main roz subah chai peeta hoon.", english: "I drink tea every morning.", hint: "Simple present for habits" },
    { native: "कल बहुत बारिश हुई थी।", roman: "Kal bahut baarish hui thi.", english: "It rained a lot yesterday.", hint: "Past tense" },
    { native: "क्या आप मेरी मदद कर सकते हैं?", roman: "Kya aap meri madad kar sakte hain?", english: "Can you help me?", hint: "Question with 'can'" },
    { native: "मेरा भाई मुंबई में काम करता है।", roman: "Mera bhai Mumbai mein kaam karta hai.", english: "My brother works in Mumbai.", hint: "He/she + verb + s" },
    { native: "हम अगले हफ़्ते गोवा जाएँगे।", roman: "Hum agle hafte Goa jaayenge.", english: "We will go to Goa next week.", hint: "Future with 'will'" },
    { native: "मुझे यह किताब बहुत पसंद है।", roman: "Mujhe yeh kitaab bahut pasand hai.", english: "I like this book very much.", hint: "'Like' + thing" },
    { native: "तुम कहाँ रहते हो?", roman: "Tum kahaan rehte ho?", english: "Where do you live?", hint: "Question with 'do'" },
    { native: "मैंने अभी खाना खाया है।", roman: "Maine abhi khaana khaaya hai.", english: "I have just eaten.", hint: "Present perfect with 'just'" },
  ],
  mr: [
    { native: "मी रोज सकाळी चहा पितो.", roman: "Mi roj sakali chaha pito.", english: "I drink tea every morning.", hint: "Simple present for habits" },
    { native: "काल खूप पाऊस पडला.", roman: "Kaal khup paus padla.", english: "It rained a lot yesterday.", hint: "Past tense" },
    { native: "तुम्ही मला मदत करू शकता का?", roman: "Tumhi mala madat karu shakta ka?", english: "Can you help me?", hint: "Question with 'can'" },
    { native: "माझा भाऊ मुंबईत काम करतो.", roman: "Majha bhau Mumbait kaam karto.", english: "My brother works in Mumbai.", hint: "He/she + verb + s" },
    { native: "आम्ही पुढच्या आठवड्यात गोव्याला जाणार आहोत.", roman: "Aamhi pudhchya aathvadyat Govyala janar aahot.", english: "We are going to Goa next week.", hint: "Future plan: 'are going to'" },
    { native: "मला हे पुस्तक खूप आवडते.", roman: "Mala he pustak khup aavadte.", english: "I like this book very much.", hint: "'Like' + thing" },
    { native: "तू कुठे राहतोस?", roman: "Tu kuthe rahtos?", english: "Where do you live?", hint: "Question with 'do'" },
    { native: "मी आत्ताच जेवलो.", roman: "Mi aattach jevlo.", english: "I have just eaten.", hint: "Present perfect with 'just'" },
  ],
};
