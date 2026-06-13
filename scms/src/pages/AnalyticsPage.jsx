import React, { useEffect, useState } from 'react';
import supabase from "../config/SupabaseClient"
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, CartesianGrid, Legend
} from 'recharts';

const AnimatedChart = ({ children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const domRef = React.useRef();

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        if (domRef.current) observer.observe(domRef.current);
        return () => observer.disconnect();
    }, []);

    return <div ref={domRef} style={{ width: '100%', height: '100%' }}>{isVisible ? children : null}</div>;
};

const chartTranslations = {
    'hi-IN-u-nu-deva': {
        'Active': 'सक्रिय',
        'Inactive': 'निष्क्रिय',
        'Inbound': 'आवक',
        'Outbound': 'जावक',
        'Filled': 'भरा हुआ',
        'In Transit': 'पारगमन में',
        'Delivered': 'वितरित',
        'Pending': 'लंबित',
        'Assigned': 'आवंटित',
        'On hand': 'उपलब्ध स्टॉक',
        'Unknown': 'अज्ञात',
        'Gemini_hub': 'जेमिनी हब',
        'Gemini': 'जेमिनी',
        'hub': 'हब',
        'Hub': 'हब',
        'Surat': 'सूरत',
        'Nagpur': 'नागपुर',
        'Bhopal': 'भोपाल',
        'Patna': 'पटना',
        'Chandigarh': 'चंडीगढ़',
        'Mumbai': 'मुंबई',
        'Delhi': 'दिल्ली',
        'Chennai': 'चेन्नई',
        'Kolkata': 'कोलकाता',
        'Bengaluru': 'बेंगलुरु',
        'Bangalore': 'बेंगलुरु',
        'Hyderabad': 'हैदराबाद',
        'Pune': 'पुणे',
        'Ahmedabad': 'अहमदाबाद',
        'Warehouse': 'गोदाम',
        'Jaipur': 'जयपुर',
        'Lucknow': 'लखनऊ'
    },
    'mr-IN-u-nu-deva': {
        'Active': 'सक्रिय',
        'Inactive': 'निष्क्रिय',
        'Inbound': 'आवक',
        'Outbound': 'जावक',
        'Filled': 'भरलेले',
        'In Transit': 'वाहतुकीत',
        'Delivered': 'वितरित',
        'Pending': 'प्रलंबित',
        'Assigned': 'नियुक्त',
        'On hand': 'उपलब्ध',
        'Unknown': 'अज्ञात',
        'Gemini_hub': 'जेमिनी हब',
        'Gemini': 'जेमिनी',
        'hub': 'हब',
        'Hub': 'हब',
        'Surat': 'सुरत',
        'Nagpur': 'नागपूर',
        'Bhopal': 'भोपाळ',
        'Patna': 'पाटणा',
        'Chandigarh': 'चंदीगड',
        'Mumbai': 'मुंबई',
        'Delhi': 'दिल्ली',
        'Chennai': 'चेन्नई',
        'Kolkata': 'कोलकाता',
        'Bengaluru': 'बेंगळुरू',
        'Bangalore': 'बेंगळुरू',
        'Hyderabad': 'हैदराबाद',
        'Pune': 'पुणे',
        'Ahmedabad': 'अहमदाबाद',
        'Warehouse': 'गोदाम',
        'Jaipur': 'जयपूर',
        'Lucknow': 'लखनौ'
    },
    'ta-IN-u-nu-tamldec': {
        'Active': 'செயலில்',
        'Inactive': 'செயலற்றது',
        'Inbound': 'உள்வரும்',
        'Outbound': 'வெளிச்செல்லும்',
        'Filled': 'நிரப்பப்பட்டது',
        'In Transit': 'போக்குவரத்தில்',
        'Delivered': 'விநியோகிக்கப்பட்டது',
        'Pending': 'நிலுவையில் உள்ளது',
        'Assigned': 'ஒதுக்கப்பட்டது',
        'On hand': 'இருப்பில் உள்ளது',
        'Unknown': 'அறியப்படாதது',
        'Gemini_hub': 'ஜெமினி மையம்',
        'Gemini': 'ஜெமினி',
        'hub': 'மையம்',
        'Hub': 'மையம்',
        'Surat': 'சூரத்',
        'Nagpur': 'நாக்பூர்',
        'Bhopal': 'போபால்',
        'Patna': 'பாட்னா',
        'Chandigarh': 'சண்டிகர்',
        'Mumbai': 'மும்பை',
        'Delhi': 'டெல்லி',
        'Chennai': 'சென்னை',
        'Kolkata': 'கொல்கத்தா',
        'Bengaluru': 'பெங்களூரு',
        'Bangalore': 'பெங்களூரு',
        'Hyderabad': 'ஹைதராபாத்',
        'Pune': 'புனே',
        'Ahmedabad': 'அகமதாபாத்',
        'Warehouse': 'கிடங்கு',
        'Jaipur': 'ஜெய்ப்பூர்',
        'Lucknow': 'லக்னோ'
    },
    'te-IN-u-nu-telu': {
        'Active': 'క్రియాశీలక',
        'Inactive': 'నిష్క్రియ',
        'Inbound': 'ఇన్‌బౌండ్',
        'Outbound': 'అవుట్‌బౌండ్',
        'Filled': 'నిండినది',
        'In Transit': 'రవాణాలో ఉంది',
        'Delivered': 'పంపిణీ చేయబడింది',
        'Pending': 'పెండింగ్‌లో ఉంది',
        'Assigned': 'కేటాయించబడింది',
        'On hand': 'అందుబాటులో ఉంది',
        'Unknown': 'తెలియదు',
        'Gemini_hub': 'జెమిని హబ్',
        'Gemini': 'జెమిని',
        'hub': 'హబ్',
        'Hub': 'హబ్',
        'Surat': 'సూరత్',
        'Nagpur': 'నాగ్‌పూర్',
        'Bhopal': 'భోపాల్',
        'Patna': 'పాట్నా',
        'Chandigarh': 'చండీగఢ్',
        'Mumbai': 'ముంబై',
        'Delhi': 'ఢిల్లీ',
        'Chennai': 'చెన్నై',
        'Kolkata': 'కోల్‌కతా',
        'Bengaluru': 'బెంగళూరు',
        'Bangalore': 'బెంగళూరు',
        'Hyderabad': 'హైదరాబాద్',
        'Pune': 'పూణే',
        'Ahmedabad': 'అహ్మదాబాద్',
        'Warehouse': 'గిడ్డంగి',
        'Jaipur': 'జైపూర్',
        'Lucknow': 'లక్నో'
    },
    'kn-IN-u-nu-knda': {
        'Active': 'ಸಕ್ರಿಯ',
        'Inactive': 'ನಿಷ್ಕ್ರಿಯ',
        'Inbound': 'ಒಳಬರುವ',
        'Outbound': 'ಹೊರಹೋಗುವ',
        'Filled': 'ಭರ್ತಿಯಾಗಿದೆ',
        'In Transit': 'ಸಾರಿಗೆಯಲ್ಲಿದೆ',
        'Delivered': 'ವಿತರಿಸಲಾಗಿದೆ',
        'Pending': 'ಬಾಕಿ ಇದೆ',
        'Assigned': 'ನಿಯೋಜಿಸಲಾಗಿದೆ',
        'On hand': 'ದಾಸ್ತಾನಿನಲ್ಲಿದೆ',
        'Unknown': 'ಅಜ್ಞಾತ',
        'Gemini_hub': 'ಜೆಮಿನಿ ಹಬ್',
        'Gemini': 'ಜೆಮಿನಿ',
        'hub': 'ಹಬ್',
        'Hub': 'ಹಬ್',
        'Surat': 'ಸೂರತ್',
        'Nagpur': 'ನಾಗ್ಪುರ',
        'Bhopal': 'ಭೋಪಾಲ್',
        'Patna': 'ಪಾಟ್ನಾ',
        'Chandigarh': 'ಚಂಡೀಗಢ್',
        'Mumbai': 'ಮುಂಬೈ',
        'Delhi': 'ದೆಹಲಿ',
        'Chennai': 'ಚೆನ್ನೈ',
        'Kolkata': 'ಕೋಲ್ಕತ್ತಾ',
        'Bengaluru': 'ಬೆಂಗಳೂರು',
        'Bangalore': 'ಬೆಂಗಳೂರು',
        'Hyderabad': 'ಹೈದರಾಬಾದ್',
        'Pune': 'ಪುಣೆ',
        'Ahmedabad': 'ಅಹಮದಾಬಾದ್',
        'Warehouse': 'ಗೋದಾಮು',
        'Jaipur': 'ಜೈಪುರ',
        'Lucknow': 'ಲಕ್ನೋ'
    },
    'ml-IN-u-nu-mlym': {
        'Active': 'സജീവം',
        'Inactive': 'നിഷ്ക്രിയം',
        'Inbound': 'ഇൻബൗണ്ട്',
        'Outbound': 'ഔട്ട്ബൗണ്ട്',
        'Filled': 'നിറഞ്ഞു',
        'In Transit': 'വഴിയിലാണ്',
        'Delivered': 'വിതരണം ചെയ്തു',
        'Pending': 'തീർപ്പാക്കാത്തത്',
        'Assigned': 'അനുവദിച്ചു',
        'On hand': 'കൈവശമുള്ളത്',
        'Unknown': 'അജ്ഞാതം',
        'Gemini_hub': 'ജെമിനി ഹബ്ബ്',
        'Gemini': 'ജെമിനി',
        'hub': 'ഹബ്ബ്',
        'Hub': 'ഹബ്ബ്',
        'Surat': 'സൂററ്റ്',
        'Nagpur': 'നാഗ്പൂർ',
        'Bhopal': 'ഭോപ്പാൽ',
        'Patna': 'പട്ന',
        'Chandigarh': 'ചണ്ഡീഗഡ്',
        'Mumbai': 'മുംബൈ',
        'Delhi': 'ഡൽഹി',
        'Chennai': 'ചെന്നൈ',
        'Kolkata': 'കൊൽക്കത്ത',
        'Bengaluru': 'ബംഗളൂരു',
        'Bangalore': 'ബാംഗ്ലൂർ',
        'Hyderabad': 'ഹൈദരാബാദ്',
        'Pune': 'പൂനെ',
        'Ahmedabad': 'അഹമ്മദാബാദ്',
        'Warehouse': 'വെയർഹൗസ്',
        'Jaipur': 'ജയ്പൂർ',
        'Lucknow': 'ലഖ്‌നൗ'
    },
    'bn-IN-u-nu-beng': {
        'Active': 'সক্রিয়',
        'Inactive': 'নিষ্ক্রিয়',
        'Inbound': 'ইনবাউন্ড',
        'Outbound': 'আউটবাউন্ড',
        'Filled': 'পূর্ণ',
        'In Transit': 'পরিবহনে রয়েছে',
        'Delivered': 'বিতরণ করা হয়েছে',
        'Pending': 'মুলতুবি',
        'Assigned': 'বরাদ্দকৃত',
        'On hand': 'হাতে রয়েছে',
        'Unknown': 'অজানা',
        'Gemini_hub': 'জেমিনি হাব',
        'Gemini': 'জেমিনি',
        'hub': 'হাব',
        'Hub': 'হাব',
        'Surat': 'সুরাট',
        'Nagpur': 'নাগপুর',
        'Bhopal': 'ভোপাল',
        'Patna': 'পাটনা',
        'Chandigarh': 'চণ্ডীগড়',
        'Mumbai': 'মুম্বাই',
        'Delhi': 'দিল্লি',
        'Chennai': 'চেন্নাই',
        'Kolkata': 'কলকাতা',
        'Bengaluru': 'বেঙ্গালুরু',
        'Bangalore': 'ব্যাঙ্গালোর',
        'Hyderabad': 'হায়দ্রাবাদ',
        'Pune': 'পুনে',
        'Ahmedabad': 'আহমেদাবাদ',
        'Warehouse': 'গুদাম',
        'Jaipur': 'জয়পুর',
        'Lucknow': 'লখনউ'
    },
    'gu-IN-u-nu-gujr': {
        'Active': 'સક્રિય',
        'Inactive': 'નિષ્ક્રિય',
        'Inbound': 'ઇનબાઉન્ડ',
        'Outbound': 'આઉટબાઉન્ડ',
        'Filled': 'ભરેલું',
        'In Transit': 'માર્ગમાં છે',
        'Delivered': 'વિતરિત',
        'Pending': 'બાકી છે',
        'Assigned': 'સોંપેલ',
        'On hand': 'હાથ પર છે',
        'Unknown': 'અજ્ઞાત',
        'Gemini_hub': 'જેમિની હબ',
        'Gemini': 'જેમિની',
        'hub': 'હબ',
        'Hub': 'હબ',
        'Surat': 'સુરત',
        'Nagpur': 'નાગપુર',
        'Bhopal': 'ભોપાલ',
        'Patna': 'પટના',
        'Chandigarh': 'ચંદીગઢ',
        'Mumbai': 'મુંબઇ',
        'Delhi': 'દિલ્હી',
        'Chennai': 'ચેન્નાઇ',
        'Kolkata': 'કોલકાતા',
        'Bengaluru': 'બેંગલુરુ',
        'Bangalore': 'બેંગલોર',
        'Hyderabad': 'હૈદરાબાદ',
        'Pune': 'પુણે',
        'Ahmedabad': 'અમદાવાદ',
        'Warehouse': 'ગોડાઉન',
        'Jaipur': 'જયપુર',
        'Lucknow': 'લખનૌ'
    },
    'pa-IN-u-nu-guru': {
        'Active': 'ਸਰਗਰਮ',
        'Inactive': 'ਨਿਸ਼ਕਿਰਿਆ',
        'Inbound': 'ਇਨਬਾਉਂਡ',
        'Outbound': 'ਆਊਟਬਾਉਂਡ',
        'Filled': 'ਭਰਿਆ ਹੋਇਆ',
        'In Transit': 'ਮਾਰਗ ਵਿੱਚ',
        'Delivered': 'ਡਿਲੀਵਰ ਕੀਤਾ',
        'Pending': 'ਲੰਬਿਤ',
        'Assigned': 'ਸੌਂਪਿਆ ਗਿਆ',
        'On hand': 'ਉਪਲਬਧ',
        'Unknown': 'ਅਣਜਾਣ',
        'Gemini_hub': 'ਜੇਮਿਨੀ ਹੱਬ',
        'Gemini': 'ਜੇਮਿਨੀ',
        'hub': 'ਹੱਬ',
        'Hub': 'ਹੱਬ',
        'Surat': 'ਸੂਰਤ',
        'Nagpur': 'ਨਾਗਪੁਰ',
        'Bhopal': 'ਭੋਪਾਲ',
        'Patna': 'ਪਟਨਾ',
        'Chandigarh': 'ਚੰਡੀਗੜ੍ਹ',
        'Mumbai': 'ਮੁੰਬਈ',
        'Delhi': 'ਦਿੱਲੀ',
        'Chennai': 'ਚੇਨਈ',
        'Kolkata': 'ਕੋਲਕਾਤਾ',
        'Bengaluru': 'ਬੈਂਗਲੁਰੂ',
        'Bangalore': 'ਬੈਂਗਲੁਰੂ',
        'Hyderabad': 'ਹੈਦਰਾਬਾਦ',
        'Pune': 'ਪੁਣੇ',
        'Ahmedabad': 'ਅਹਿਮਦਾਬਾਦ',
        'Warehouse': 'ਗੋਦਾਮ',
        'Jaipur': 'ਜੈਪੁਰ',
        'Lucknow': 'ਲਖਨਊ'
    },
    'or-IN-u-nu-orya': {
        'Active': 'ସକ୍ରିୟ',
        'Inactive': 'ନିଷ୍କ୍ରିୟ',
        'Inbound': 'ଇନବାଉଣ୍ଡ',
        'Outbound': 'ଆଉଟବାଉଣ୍ଡ',
        'Filled': 'ପୂର୍ଣ୍ଣ',
        'In Transit': 'ପରିବਹନରେ',
        'Delivered': 'ବିତରଣ ହୋଇଛି',
        'Pending': 'ପେଣ୍ଡିଂ',
        'On hand': 'ଉପଲବ୍ଧ',
        'Unknown': 'ଅଜଣା',
        'Mumbai': 'ମୁମ୍ବାଇ',
        'Delhi': 'ଦିଲ୍ଲୀ',
        'Chennai': 'ଚେନ୍ନାଇ',
        'Kolkata': 'କୋଲକାତା',
        'Bengaluru': 'ବେଙ୍ଗାଲୁରୁ',
        'Bangalore': 'ବେଙ୍ଗାଲୁରୁ',
        'Hyderabad': 'ହାଇଦ୍ରାବାଦ',
        'Pune': 'ପୁଣେ',
        'Ahmedabad': 'ଅହମଦାବାਦ',
        'Warehouse': 'ଗୋଦାମ',
        'Hub': 'ହବ୍',
        'Assigned': 'ଆବଣ୍ଟିତ',
        'Gemini_hub': 'ଜେମିନି ହବ୍',
        'Gemini': 'ଜେମିନି',
        'hub': 'ହବ୍',
        'Surat': 'ସୁରଟ',
        'Nagpur': 'ନାଗପୁର',
        'Bhopal': 'ଭୋପାଳ',
        'Patna': 'ପାଟନା',
        'Chandigarh': 'ଚଣ୍ଡୀਗଡ଼',
        'Jaipur': 'ଜୟପୁର',
        'Lucknow': 'ଲକ୍ଷ୍ନୌ'
    },
    'ar-EG-u-nu-arab': {
        'Active': 'نشط',
        'Inactive': 'غير نشط',
        'Inbound': 'الوارد',
        'Outbound': 'الصادر',
        'Filled': 'ممتلئ',
        'In Transit': 'في الطريق',
        'Delivered': 'تم التوصيل',
        'Pending': 'قيد الانتظار',
        'On hand': 'متوفر',
        'Unknown': 'غير معروف',
        'Mumbai': 'مومباي',
        'Delhi': 'دلهي',
        'Chennai': 'تشيناي',
        'Kolkata': 'كولكاتا',
        'Bengaluru': 'بنغالور',
        'Bangalore': 'بنغالور',
        'Hyderabad': 'حيدر أباد',
        'Pune': 'بونه',
        'Ahmedabad': 'أحمد آباد',
        'Warehouse': 'مستودع',
        'Hub': 'مركز',
        'Assigned': 'تم التعيين',
        'Gemini_hub': 'مركز جيميني',
        'Gemini': 'جيميني',
        'hub': 'مركز',
        'Surat': 'سورات',
        'Nagpur': 'ناغبور',
        'Bhopal': 'بوبال',
        'Patna': 'باتنا',
        'Chandigarh': 'شانديغار',
        'Jaipur': 'جايبور',
        'Lucknow': 'لكناو'
    }
};

const AnalyticsPage = () => {
    const [data, setData] = useState({
        warehouses: [],
        logs: [],
        reroutes: [],
        fleet: [],
        orders: [],
        drivers: [],
        warehouseStats: []
    });

    // We only use loading for the initial load, no global error state anymore
    const [loading, setLoading] = useState(true);

    // Locale detection — reads Google Translate cookie every 2s so numbers render in the active language's numeral system
    const [locale, setLocale] = useState('en-IN');

    const t = (text) => {
        if (!text) return '';
        const rawKey = text.trim();
        const translations = chartTranslations[locale];
        if (!translations) return text;

        if (translations[rawKey]) return translations[rawKey];

        const spaceKey = rawKey.replace(/_/g, ' ');
        if (translations[spaceKey]) return translations[spaceKey];

        const words = spaceKey.split(/\s+/);
        if (words.length > 1) {
            return words.map(w => translations[w] || w).join(' ');
        }

        return translations[rawKey] || text;
    };

    const formatNumber = (num) => {
        if (num === null || num === undefined || isNaN(num)) return '';
        return Number(num).toLocaleString('en-IN');
    };
    useEffect(() => {
        const detectLocale = () => {
            try {
                let lang = '';
                const cookie = document.cookie.split(';').find(c => c.trim().startsWith('googtrans='));
                if (cookie) {
                    lang = cookie.trim().split('=')[1].split('/').pop();
                }

                // Fallback to html lang attribute if cookie not found or is 'en'
                if (!lang || lang.toLowerCase() === 'en') {
                    const htmlLang = document.documentElement.lang || document.documentElement.getAttribute('lang');
                    if (htmlLang) {
                        lang = htmlLang.split('-')[0].split('_')[0];
                    }
                }

                if (lang) {
                    const localeMap = {
                        'hi': 'hi-IN-u-nu-deva',   // Devanagari
                        'mr': 'mr-IN-u-nu-deva',   // Marathi (Devanagari)
                        'ta': 'ta-IN-u-nu-tamldec', // Tamil
                        'te': 'te-IN-u-nu-telu',   // Telugu
                        'kn': 'kn-IN-u-nu-knda',   // Kannada
                        'ml': 'ml-IN-u-nu-mlym',   // Malayalam
                        'bn': 'bn-IN-u-nu-beng',   // Bengali
                        'gu': 'gu-IN-u-nu-gujr',   // Gujarati
                        'pa': 'pa-IN-u-nu-guru',   // Gurmukhi (Punjabi)
                        'or': 'or-IN-u-nu-orya',   // Odia
                        'ar': 'ar-EG-u-nu-arab',   // Arabic-Indic
                        'fa': 'fa-IR-u-nu-arabext', // Persian (Extended Arabic-Indic)
                        'ur': 'ur-PK-u-nu-arabext', // Urdu (Extended Arabic-Indic)
                        'th': 'th-TH-u-nu-thai',   // Thai
                        'my': 'my-MM-u-nu-mymr',   // Myanmar/Burmese
                        'si': 'si-LK',
                        'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'ja': 'ja-JP',
                        'ko': 'ko-KR', 'ru': 'ru-RU', 'fr': 'fr-FR',
                        'de': 'de-DE', 'es': 'es-ES', 'pt': 'pt-BR',
                        'it': 'it-IT', 'nl': 'nl-NL', 'pl': 'pl-PL', 'tr': 'tr-TR',
                        'en': 'en-IN',
                    };
                    setLocale(localeMap[lang] || 'en-IN');
                } else {
                    setLocale('en-IN');
                }
            } catch (e) { }
        };
        detectLocale();
        const intervalId = setInterval(detectLocale, 2000);
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);

            // 1. Warehouses
            let wData = [];
            try {
                const { data: resData, error } = await supabase.from('warehouses').select('*');
                if (error) throw error;
                wData = resData || [];
            } catch (err) {
                console.error('warehouses fetch failed:', err);
            }

            // 2. Warehouse Logs
            let lData = [];
            try {
                const { data: resData, error } = await supabase.from('warehouse_logs').select('*').order('triggered_at', { ascending: false }).limit(10);
                if (error) throw error;
                lData = resData || [];
            } catch (err) {
                console.error('warehouse_logs fetch failed:', err);
            }

            // 3. Truck Reroutes
            let rData = [];
            try {
                const { data: resData, error } = await supabase.from('truck_reroutes').select('*');
                if (error) throw error;
                rData = resData || [];
            } catch (err) {
                console.error('truck_reroutes fetch failed:', err);
            }

            // 4. Fleet
            let fData = [];
            try {
                // Trying lowercase first, if your table is exactly "Fleet" we log the error
                const { data: resData, error } = await supabase.from('Fleet').select('*');
                if (error) throw error;
                fData = resData || [];
            } catch (err) {
                console.error('fleet table fetch failed:', err);
            }

            // 5. Orders
            let oData = [];
            try {
                const { data: resData, error } = await supabase.from('Load').select('*');
                if (error) throw error;
                oData = resData || [];
            } catch (err) {
                console.error('load_id table fetch failed:', err);
            }

            // 6. Drivers
            let dData = [];
            try {
                const { data: resData, error } = await supabase.from('driver').select('*');
                if (error) throw error;
                dData = resData || [];
            } catch (err) {
                console.error('drivers fetch failed:', err);
            }

            // 7. Warehouse Stats
            let wsData = [];
            try {
                const { data: resData, error } = await supabase.from('warehouse').select('*');
                if (error) throw error;
                wsData = resData || [];
            } catch (err) {
                console.error('warehouse (stats) fetch failed:', err);
            }

            setData({
                warehouses: wData,
                logs: lData,
                reroutes: rData,
                fleet: fData,
                orders: oData,
                drivers: dData,
                warehouseStats: wsData
            });

            setLoading(false);
        };

        fetchAllData();
    }, []);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', color: '#1e293b' }}>
                <h2>Loading Analytics...</h2>
            </div>
        );
    }

    // --- Data Processing ---

    // SECTION 1
    const totalWarehouses = data.warehouses.length;
    const overflowingWarehouses = data.warehouses.filter(w => {
        const cap = w.max_capacity || 1;
        return ((w.current_load + (w.reserved_space || 0)) / cap) > 0.85;
    }).length;

    const totalTrucks = data.fleet.length;
    const activeTrucks = data.fleet.filter(t =>
        t.vehicle_status === true || t.vehicle_status === 'true' ||
        t["vehicle status"] === true || t["vehicle status"] === 'true'
    ).length;

    const totalOrders = data.orders.length;
    const totalDrivers = data.drivers.length;

    // SECTION 2
    const warehouseCapacityData = data.warehouses.map(w => {
        const fillPercent = Math.round(((w.current_load + (w.reserved_space || 0)) / (w.max_capacity || 1)) * 100);

        return {
            name: t(w.name || 'Unknown'),
            fillPercent,
            current_load: w.current_load || 0,
            max_capacity: w.max_capacity || 0,
            colorId: fillPercent > 85 ? 'colorRed' : fillPercent >= 60 ? 'colorOrange' : 'colorGreen'
        };
    });

    // SECTION 3
    const orderStatusCounts = data.orders.reduce((acc, order) => {
        const status = order.status ? order.status : 'Pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    const orderStatusData = Object.keys(orderStatusCounts).map(status => ({
        name: t(status),
        value: orderStatusCounts[status]
    }));
    const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    // SECTION 4
    const fleetDonutData = [
        { name: t('Active'), value: activeTrucks },
        { name: t('Inactive'), value: totalTrucks - activeTrucks }
    ];
    const DONUT_COLORS = ['#10b981', '#64748b'];

    // SECTION 5
    const sortedDrivers = [...data.drivers].sort((a, b) => (b.rating || 0) - (a.rating || 0));

    // SECTION 7
    const ioData = data.warehouseStats.map(w => ({
        name: t(w.warehouse_name || 'Unknown'),
        inbound: Number(w.inbound) || 0,
        outbound: Number(w.outbound) || 0,
        onhand: Number(w.onhand) || 0
    }));

    // Reusable styles
    const cardStyle = {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.05)',
        border: '1px solid rgba(249, 115, 22, 0.3)'
    };

    const titleStyle = { margin: '0 0 16px 0', fontSize: '1.1rem', color: '#f97316', fontWeight: '600', textTransform: 'uppercase' };
    const emptyStateStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b', fontStyle: 'italic', minHeight: '200px' };

    // Removed unused getStatusText

    return (
        <div style={{ padding: '24px', backgroundColor: 'transparent', minHeight: '100vh', color: '#1e293b', boxSizing: 'border-box' }}>
            <h1 style={{ margin: '0 0 24px 0', color: '#f97316', textTransform: 'uppercase' }}>SCMS Analytics</h1>

            {/* SECTION 1: Top KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div style={cardStyle}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Total Warehouses</p>
                    <h2 style={{ margin: '8px 0 0 0', fontSize: '2rem', color: '#1e293b' }}>{data.warehouses.length > 0 ? formatNumber(totalWarehouses) : '-'}</h2>
                </div>
                <div style={cardStyle}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Overflowing Warehouses</p>
                    <h2 style={{ margin: '8px 0 0 0', fontSize: '2rem', color: overflowingWarehouses > 0 ? '#ef4444' : '#1e293b' }}>{data.warehouses.length > 0 ? formatNumber(overflowingWarehouses) : '-'}</h2>
                </div>
                <div style={cardStyle}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Total Trucks</p>
                    <h2 style={{ margin: '8px 0 0 0', fontSize: '2rem', color: '#1e293b' }}>{data.fleet.length > 0 ? formatNumber(totalTrucks) : '-'}</h2>
                </div>
                <div style={cardStyle}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Active Trucks</p>
                    <h2 style={{ margin: '8px 0 0 0', fontSize: '2rem', color: '#10b981' }}>{data.fleet.length > 0 ? formatNumber(activeTrucks) : '-'}</h2>
                </div>
                <div style={cardStyle}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Total Orders</p>
                    <h2 style={{ margin: '8px 0 0 0', fontSize: '2rem', color: '#1e293b' }}>{data.orders.length > 0 ? formatNumber(totalOrders) : '-'}</h2>
                </div>
                <div style={cardStyle}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Total Drivers</p>
                    <h2 style={{ margin: '8px 0 0 0', fontSize: '2rem', color: '#1e293b' }}>{data.drivers.length > 0 ? formatNumber(totalDrivers) : '-'}</h2>
                </div>
            </div>

            {/* Middle Row Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginBottom: '24px' }}>

                {/* SECTION 2: Warehouse Capacity */}
                <div style={cardStyle}>
                    <h3 style={titleStyle}>Warehouse Capacity (%)</h3>
                    <div style={{ width: '100%', height: 300 }} className="notranslate">
                        {warehouseCapacityData.length > 0 ? (
                            <ResponsiveContainer>
                                <AnimatedChart>
                                    <BarChart data={warehouseCapacityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.1" />
                                                <feGaussianBlur stdDeviation="2" result="blur" />
                                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                            </filter>
                                            <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#86efac" stopOpacity={1} />
                                                <stop offset="40%" stopColor="#22c55e" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#15803d" stopOpacity={0.8} />
                                            </linearGradient>
                                            <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#fde047" stopOpacity={1} />
                                                <stop offset="40%" stopColor="#f97316" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#c2410c" stopOpacity={0.8} />
                                            </linearGradient>
                                            <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#fca5a5" stopOpacity={1} />
                                                <stop offset="40%" stopColor="#ef4444" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.8} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickFormatter={(val) => val.split(' ')[0]} />
                                        <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => formatNumber(val)} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b' }}
                                            formatter={(value, name, props) => [`${formatNumber(value)}% (${formatNumber(props.payload.current_load)}/${formatNumber(props.payload.max_capacity)})`, t('Filled')]}
                                        />
                                        <Bar dataKey="fillPercent" radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={1200} filter="url(#glow)">
                                            {warehouseCapacityData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={`url(#${entry.colorId})`} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </AnimatedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={emptyStateStyle}>No data available</div>
                        )}
                    </div>
                </div>

                {/* SECTION 7: Inbound vs Outbound */}
                <div style={cardStyle}>
                    <h3 style={titleStyle}>Inbound vs Outbound Volume</h3>
                    <div style={{ width: '100%', height: 300 }} className="notranslate">
                        {ioData.length > 0 ? (
                            <ResponsiveContainer>
                                <AnimatedChart>
                                    <BarChart data={ioData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <filter id="glowInOut" x="-20%" y="-20%" width="140%" height="140%">
                                                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.1" />
                                                <feGaussianBlur stdDeviation="2" result="blur" />
                                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                            </filter>
                                            <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#93c5fd" stopOpacity={1} />
                                                <stop offset="40%" stopColor="#3b82f6" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8} />
                                            </linearGradient>
                                            <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#fde047" stopOpacity={1} />
                                                <stop offset="40%" stopColor="#f97316" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#c2410c" stopOpacity={0.8} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickFormatter={(val) => val?.split(' ')[0] || val} />
                                        <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => formatNumber(val)} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b' }}
                                            formatter={(value, name, props) => [`${formatNumber(value)} (${t('On hand')}: ${formatNumber(props.payload.onhand)})`, name]}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '12px', color: '#64748b' }} />
                                        <Bar dataKey="inbound" name={t('Inbound')} fill="url(#colorInbound)" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1200} filter="url(#glowInOut)" />
                                        <Bar dataKey="outbound" name={t('Outbound')} fill="url(#colorOutbound)" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1200} filter="url(#glowInOut)" />
                                    </BarChart>
                                </AnimatedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={emptyStateStyle}>No data available</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>

                {/* SECTION 3 & 4: Pie/Donut Charts Container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={cardStyle}>
                        <h3 style={titleStyle}>Order Status Distribution</h3>
                        <div style={{ width: '100%', height: 250 }} className="notranslate">
                            {orderStatusData.length > 0 ? (
                                <ResponsiveContainer>
                                    <AnimatedChart>
                                        <PieChart>
                                            <Pie data={orderStatusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${formatNumber(Math.round(percent * 100))}%`} isAnimationActive={true} animationDuration={1200}>
                                                {orderStatusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b' }}
                                                formatter={(value) => [formatNumber(value)]}
                                            />
                                        </PieChart>
                                    </AnimatedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={emptyStateStyle}>No data available</div>
                            )}
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <h3 style={titleStyle}>Fleet Status</h3>
                        <div style={{ width: '100%', height: 250 }} className="notranslate">
                            {data.fleet.length > 0 ? (
                                <ResponsiveContainer>
                                    <AnimatedChart>
                                        <PieChart>
                                            <Pie data={fleetDonutData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${formatNumber(Math.round(percent * 100))}%`} isAnimationActive={true} animationDuration={1200}>
                                                {fleetDonutData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b' }}
                                                formatter={(value, name) => [formatNumber(value), name]}
                                            />
                                            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#1e293b" fontSize={24} fontWeight="bold">
                                                {formatNumber(Math.round((activeTrucks / (totalTrucks || 1)) * 100))}%
                                            </text>
                                        </PieChart>
                                    </AnimatedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={emptyStateStyle}>No data available</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* SECTION 5: Driver Performance */}
                <div style={cardStyle}>
                    <h3 style={titleStyle}>Driver Performance Ranking</h3>
                    {sortedDrivers.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                                        <th style={{ padding: '12px 8px' }}>Driver Name</th>
                                        <th style={{ padding: '12px 8px' }}>Rating</th>
                                        <th style={{ padding: '12px 8px' }}>Status</th>
                                        <th style={{ padding: '12px 8px' }}>Last Trip</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedDrivers.slice(0, 8).map(driver => (
                                        <tr key={driver.driver_id || driver.id || Math.random()} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '12px 8px', color: '#1e293b', fontWeight: '500' }}>{driver.name}</td>
                                            <td style={{ padding: '12px 8px', color: '#f59e0b' }}>
                                                {'★'.repeat(Math.floor(driver.rating || 0))}
                                                <span style={{ color: '#cbd5e1' }}>{'★'.repeat(5 - Math.floor(driver.rating || 0))}</span>
                                                <span style={{ marginLeft: '4px', color: '#64748b' }}>{formatNumber(driver.rating)}</span>
                                            </td>
                                            <td style={{ padding: '12px 8px' }}>
                                                <span style={{
                                                    padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem',
                                                    backgroundColor: driver.status?.toLowerCase() === 'assigned' ? '#d1fae5' :
                                                        driver.status?.toLowerCase() === 'available' ? '#dbeafe' : '#f1f5f9',
                                                    color: driver.status?.toLowerCase() === 'assigned' ? '#059669' :
                                                        driver.status?.toLowerCase() === 'available' ? '#2563eb' : '#64748b'
                                                }}>
                                                    {driver.status || 'Offline'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 8px', color: '#64748b' }}>{driver.last_trip || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={emptyStateStyle}>No data available</div>
                    )}
                </div>

                {/* SECTION 6: Warehouse Events Timeline */}
                <div style={cardStyle}>
                    <h3 style={titleStyle}>Warehouse Events Log</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {data.logs.length > 0 ? data.logs.map(log => {
                            let badgeColor = '#10b981'; // restored = green
                            let bgColor = '#d1fae5';

                            if (log.event_type === 'overflow') {
                                badgeColor = '#ef4444'; bgColor = '#fee2e2';
                            } else if (log.event_type === 'reroute') {
                                badgeColor = '#f59e0b'; bgColor = '#fef3c7';
                            }

                            // Calculate time ago safely
                            let timeStr = 'Just now';
                            if (log.triggered_at) {
                                const minutesAgo = Math.floor((new Date() - new Date(log.triggered_at)) / 60000);
                                timeStr = minutesAgo < 60 ? formatNumber(minutesAgo) + ' mins ago' : formatNumber(Math.floor(minutesAgo / 60)) + ' hours ago';
                            }

                            return (
                                <div key={log.id || Math.random()} style={{ display: 'flex', gap: '12px', borderLeft: `2px solid ${badgeColor}`, paddingLeft: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{
                                                backgroundColor: bgColor, color: badgeColor, fontSize: '0.75rem',
                                                padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold',
                                                textTransform: 'uppercase'
                                            }}>
                                                {log.event_type || 'Event'}
                                            </span>
                                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{timeStr}</span>
                                        </div>
                                        <p style={{ margin: '0 0 4px 0', color: '#1e293b', fontSize: '0.9rem', fontWeight: '500' }}>{log.message || 'Unknown event occurred.'}</p>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div style={emptyStateStyle}>No data available</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
