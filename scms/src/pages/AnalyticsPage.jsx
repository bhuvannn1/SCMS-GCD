import React, { useEffect, useState } from 'react';
import supabase from "../config/SupabaseClient"
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, CartesianGrid, Legend, AreaChart, Area
} from 'recharts';
import { Activity, AlertTriangle, Flame, PackageCheck, Route, Timer, Truck, Warehouse } from 'lucide-react';
import KineticLoader from '../components/KineticLoader';

const BackgroundShader = () => {
    useEffect(() => {
        const canvas = document.getElementById('analytics-shader-canvas');
        if (!canvas) return;
        
        function syncSize() {
            const w = canvas.clientWidth || window.innerWidth;
            const h = canvas.clientHeight || window.innerHeight;
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
        }
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(syncSize).observe(canvas);
        }
        syncSize();

        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return;
        
        const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
        const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
    vec2 uv = v_texCoord;
    float noise = sin(uv.x * 10.0 + u_time * 0.5) * cos(uv.y * 8.0 - u_time * 0.3);
    float glow = smoothstep(0.4, 0.6, noise * 0.5 + 0.5);
    vec3 baseColor = vec3(0.043, 0.059, 0.098); // #0B0F19
    vec3 glowColor = vec3(1.0, 0.42, 0.0); // #FF6B00
    vec3 finalColor = mix(baseColor, glowColor, glow * 0.15);
    float dist = distance(uv, vec2(0.5));
    finalColor *= 1.0 - smoothstep(0.5, 1.2, dist);
    gl_FragColor = vec4(finalColor, 1.0);
}`;
        function cs(type, src) {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            return s;
        }
        const prog = gl.createProgram();
        gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
        gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(prog);
        gl.useProgram(prog);
        
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
        
        const pos = gl.getAttribLocation(prog, 'a_position');
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
        
        const uTime = gl.getUniformLocation(prog, 'u_time');
        const uRes = gl.getUniformLocation(prog, 'u_resolution');
        
        let animationFrameId;
        function render(t) {
            if (typeof ResizeObserver === 'undefined') syncSize();
            gl.viewport(0, 0, canvas.width, canvas.height);
            if (uTime) gl.uniform1f(uTime, t * 0.001);
            if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            animationFrameId = requestAnimationFrame(render);
        }
        render(0);
        
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return (
        <div style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', opacity: 0.4, pointerEvents: 'none', zIndex: 0 }}>
            <canvas id='analytics-shader-canvas' style={{ display: 'block', width: '100%', height: '100%' }}></canvas>
        </div>
    );
};

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
        warehouseStats: [],
        payments: []
    });

    const [loading, setLoading] = useState(true);
    const [locale, setLocale] = useState('en-IN');
    const [aiInsights, setAiInsights] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    const generateAIInsights = async () => {
        if (!data || data.warehouses.length === 0) return;
        setAiLoading(true);
        try {
            const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
            
            const summaryData = {
                totalWarehouses: data.warehouses.length,
                overflowingWarehouses: data.warehouses.filter(w => ((w.current_load + (w.reserved_space || 0)) / (w.max_capacity || 1)) > 0.85).length,
                totalOrders: data.orders.length,
                pendingOrders: data.orders.filter(o => o.status === 'Pending').length,
                totalTrucks: data.fleet.length,
                activeTrucks: data.fleet.filter(t => t.vehicle_status === true || t.vehicle_status === 'true').length,
            };

            const prompt = `You are an expert supply chain analyst. Based on this real-time SCMS data: ${JSON.stringify(summaryData)}, provide 3 short, highly actionable bullet points of insights or recommendations. Keep it concise. Focus on operational bottlenecks if any. Format as simple HTML (just <ul> and <li>, no markdown blocks).`;
            
            const result = await model.generateContent(prompt);
            let text = result.response.text();
            text = text.replace(/```html/g, '').replace(/```/g, ''); 
            setAiInsights(text);
        } catch (error) {
            console.error("Failed to generate AI insights", error);
            setAiInsights(`<p style='color: #ef4444;'>Failed to load AI insights. Error: ${error.message || error.toString()}</p>`);
        } finally {
            setAiLoading(false);
        }
    };

    const t = (text) => {
        if (!text) return '';
        const rawKey = text.trim();
        const translations = chartTranslations[locale];
        if (!translations) return text;

        if (translations[rawKey]) return translations[rawKey];

        const spaceKey = rawKey.replace(/_/g, ' ');
        if (translations[spaceKey]) return translations[spaceKey];

        const words = spaceKey.split(/\\s+/);
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

                if (!lang || lang.toLowerCase() === 'en') {
                    const htmlLang = document.documentElement.lang || document.documentElement.getAttribute('lang');
                    if (htmlLang) {
                        lang = htmlLang.split('-')[0].split('_')[0];
                    }
                }

                if (lang) {
                    const localeMap = {
                        'hi': 'hi-IN-u-nu-deva',   
                        'mr': 'mr-IN-u-nu-deva',   
                        'ta': 'ta-IN-u-nu-tamldec', 
                        'te': 'te-IN-u-nu-telu',   
                        'kn': 'kn-IN-u-nu-knda',   
                        'ml': 'ml-IN-u-nu-mlym',   
                        'bn': 'bn-IN-u-nu-beng',   
                        'gu': 'gu-IN-u-nu-gujr',   
                        'pa': 'pa-IN-u-nu-guru',   
                        'or': 'or-IN-u-nu-orya',   
                        'ar': 'ar-EG-u-nu-arab',   
                        'fa': 'fa-IR-u-nu-arabext', 
                        'ur': 'ur-PK-u-nu-arabext', 
                        'th': 'th-TH-u-nu-thai',   
                        'my': 'my-MM-u-nu-mymr',   
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

            let wData = [];
            try {
                const { data: resData, error } = await supabase.from('warehouses').select('*');
                if (error) throw error;
                wData = resData || [];
            } catch (err) {
                console.error('warehouses fetch failed:', err);
            }

            let lData = [];
            try {
                const { data: resData, error } = await supabase.from('warehouse_logs').select('*').order('triggered_at', { ascending: false }).limit(10);
                if (error) throw error;
                lData = resData || [];
            } catch (err) {
                console.error('warehouse_logs fetch failed:', err);
            }

            let rData = [];
            try {
                const { data: resData, error } = await supabase.from('truck_reroutes').select('*');
                if (error) throw error;
                rData = resData || [];
            } catch (err) {
                console.error('truck_reroutes fetch failed:', err);
            }

            let fData = [];
            try {
                const { data: resData, error } = await supabase.from('Fleet').select('*');
                if (error) throw error;
                fData = resData || [];
            } catch (err) {
                console.error('fleet table fetch failed:', err);
            }

            let oData = [];
            try {
                const { data: resData, error } = await supabase.from('Load').select('*');
                if (error) throw error;
                oData = resData || [];
            } catch (err) {
                console.error('load_id table fetch failed:', err);
            }

            let dData = [];
            try {
                const { data: resData, error } = await supabase.from('driver').select('*');
                if (error) throw error;
                dData = resData || [];
            } catch (err) {
                console.error('drivers fetch failed:', err);
            }

            let wsData = [];
            try {
                const { data: resData, error } = await supabase.from('warehouse').select('*');
                if (error) throw error;
                wsData = resData || [];
            } catch (err) {
                console.error('warehouse (stats) fetch failed:', err);
            }
            
            let pData = [];
            try {
                const { data: resData, error } = await supabase.from('payments').select('*');
                if (error) throw error;
                pData = resData || [];
            } catch (err) {
                console.error('payments fetch failed:', err);
            }

            setData({
                warehouses: wData,
                logs: lData,
                reroutes: rData,
                fleet: fData,
                orders: oData,
                drivers: dData,
                warehouseStats: wsData,
                payments: pData
            });

            setLoading(false);
        };

        fetchAllData();
    }, []);

    if (loading) {
        return <KineticLoader message="Loading Analytics..." />;
    }

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

    const orderStatusCounts = data.orders.reduce((acc, order) => {
        const status = order.status ? order.status : 'Pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    const orderStatusData = Object.keys(orderStatusCounts).map(status => ({
        name: t(status),
        value: orderStatusCounts[status]
    }));
    
    const fleetDonutData = [
        { name: t('Active'), value: activeTrucks },
        { name: t('Inactive'), value: totalTrucks - activeTrucks }
    ];

    const ioData = data.warehouseStats.map(w => ({
        name: t(w.warehouse_name || 'Unknown'),
        inbound: Number(w.inbound) || 0,
        outbound: Number(w.outbound) || 0,
        onhand: Number(w.onhand) || 0
    }));

    const paymentStatusCounts = { paid: 0, partial: 0, unpaid: 0 };
    data.orders.forEach(load => {
      const loadPayments = data.payments.filter(p => p.order_id === load.load_id && p.status === 'success');
      let totalPaidInINR = loadPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) / 100;

      if (totalPaidInINR === 0 && load.payment_status === 'paid') {
        totalPaidInINR = Number(load.buyer_amount) || 0;
      }

      const balanceDue = Math.max(0, (Number(load.buyer_amount) || 0) - totalPaidInINR);
      const isFullyPaid = balanceDue <= 0 && (totalPaidInINR > 0 || load.payment_status === 'paid');
      const isPartiallyPaid = totalPaidInINR > 0 && balanceDue > 0;

      if (isFullyPaid) paymentStatusCounts.paid++;
      else if (isPartiallyPaid) paymentStatusCounts.partial++;
      else paymentStatusCounts.unpaid++;
    });
    
    const paymentStatusData = [
        { name: t('Paid'), value: paymentStatusCounts.paid },
        { name: t('Partial'), value: paymentStatusCounts.partial },
        { name: t('Unpaid'), value: paymentStatusCounts.unpaid }
    ].filter(item => item.value > 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const rerouteDates = data.reroutes.reduce((acc, reroute) => {
        if (!reroute.created_at) return acc;
        const date = new Date(reroute.created_at);
        if (date >= thirtyDaysAgo) {
            const dateStr = date.toISOString().split('T')[0];
            acc[dateStr] = (acc[dateStr] || 0) + 1;
        }
        return acc;
    }, {});
    
    const rerouteFrequencyData = Object.keys(rerouteDates).sort().map(date => ({
        date: date,
        count: rerouteDates[date]
    }));

    const routeCounts = data.orders.reduce((acc, order) => {
        if (order.pickup && order.drop) {
            const route = `${order.pickup.split(',')[0]} → ${order.drop.split(',')[0]}`;
            acc[route] = (acc[route] || 0) + 1;
        }
        return acc;
    }, {});

    const topRoutesData = Object.keys(routeCounts)
        .map(route => ({ route, orders: routeCounts[route] }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);

    let deliveredOrders = 0;
    let onTimeDeliveries = 0;
    
    data.orders.forEach(order => {
        if (order.status?.toLowerCase() === 'delivered') {
            deliveredOrders++;
            const deliveryTime = order.actual_delivery_time ? new Date(order.actual_delivery_time) : new Date(order.updated_at || order.created_at);
            const etaTime = order.eta ? new Date(order.eta) : null;
            
            if (!etaTime || deliveryTime <= etaTime) {
                onTimeDeliveries++;
            }
        }
    });
    
    const onTimeRate = deliveredOrders > 0 ? Math.round((onTimeDeliveries / deliveredOrders) * 100) : null;

    const kpiCards = [
        { label: 'Total Warehouses', value: data.warehouses.length > 0 ? formatNumber(totalWarehouses) : '-', color: 'var(--accent)', soft: 'var(--accent-bg)', Icon: Warehouse },
        { label: 'Overflowing', value: data.warehouses.length > 0 ? formatNumber(overflowingWarehouses) : '-', color: overflowingWarehouses > 0 ? 'var(--danger, #ef4444)' : 'var(--accent)', soft: overflowingWarehouses > 0 ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent-bg)', Icon: AlertTriangle },
        { label: 'Total Trucks', value: data.fleet.length > 0 ? formatNumber(totalTrucks) : '-', color: 'var(--accent)', soft: 'var(--accent-bg)', Icon: Truck },
        { label: 'Active Trucks', value: data.fleet.length > 0 ? formatNumber(activeTrucks) : '-', color: 'var(--text-primary)', soft: 'var(--bg-inset)', Icon: Activity },
        { label: 'Total Orders', value: data.orders.length > 0 ? formatNumber(totalOrders) : '-', color: 'var(--accent)', soft: 'var(--accent-bg)', Icon: PackageCheck },
        { label: 'On-Time Rate', value: onTimeRate !== null ? `${formatNumber(onTimeRate)}%` : '-', color: 'var(--text-secondary)', soft: 'var(--bg-inset)', Icon: Timer }
    ];

    const chartShellStyle = {
        width: '100%',
        height: 320,
        borderRadius: '10px',
        background: 'transparent',
        padding: '10px',
        boxSizing: 'border-box'
    };

    const cardStyle = {
        background: 'var(--bg-card)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
        border: '1px solid var(--border-color)',
        transition: 'all 0.3s ease',
        color: 'var(--text-primary)'
    };

    const glowCardStyle = {
        ...cardStyle,
        border: '1px solid rgba(255, 107, 0, 0.4)',
        boxShadow: '0 0 15px rgba(255, 107, 0, 0.15), inset 0 0 10px rgba(255, 107, 0, 0.05)'
    };

    const titleStyle = { margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 'bold', letterSpacing: '0.01em' };
    const emptyStateStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary, #e2bfb0)', fontStyle: 'italic', minHeight: '220px' };

    return (
        <div style={{ position: 'relative', padding: '28px', backgroundColor: 'var(--analytics-bg, transparent)', minHeight: '100vh', color: 'var(--text-primary)', boxSizing: 'border-box', overflowX: 'hidden', fontFamily: "'Inter', sans-serif" }}>
            <BackgroundShader />
            
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .glass-card-hover:hover {
                    background: rgba(255, 255, 255, 0.05) !important;
                    border-color: rgba(255, 182, 147, 0.3) !important;
                }
            `}</style>
            
            <div style={{ position: 'relative', zIndex: 10 }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '32px',
                    padding: '24px',
                    borderRadius: '24px',
                    background: 'var(--bg-card)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)'
                }} className="animate-fade-in-up">
                    <div>
                        <h1 style={{ margin: 0, color: 'var(--text-primary)', textTransform: 'uppercase', fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.02em' }}>IGNIS Control</h1>
                        <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary, #e2bfb0)', fontSize: '1rem' }}>Global Operations & Analytics Dashboard</p>
                    </div>
                    <button 
                        onClick={generateAIInsights}
                        disabled={aiLoading}
                        style={{
                            padding: '12px 24px',
                            background: 'linear-gradient(90deg, #ff6b00, #ffb77f)',
                            color: '#351000',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: 800,
                            cursor: aiLoading ? 'not-allowed' : 'pointer',
                            boxShadow: '0 0 20px rgba(255, 182, 147, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'transform 0.2s ease',
                            transform: aiLoading ? 'scale(0.95)' : 'scale(1)'
                        }}
                    >
                        <Flame size={18} strokeWidth={2.5} />
                        {aiLoading ? 'Analyzing...' : 'Command Pulse'}
                    </button>
                </div>

                {/* AI Insights Panel */}
                {aiInsights && (
                    <div style={{ ...glowCardStyle, marginBottom: '32px', animationDelay: '0.1s' }} className="animate-fade-in-up">
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#ff6b00', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Flame size={20} strokeWidth={2.5} /> System Pulse Diagnostics
                        </h3>
                        <div style={{ color: 'var(--text-primary)', fontSize: '1rem', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: aiInsights }} />
                    </div>
                )}

                {/* SECTION 1: Top KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                    {kpiCards.map(({ label, value, color, soft, Icon }, idx) => (
                        <div key={label} style={{ ...cardStyle, padding: '24px', animationDelay: `${0.2 + (idx * 0.05)}s` }} className="glass-card-hover animate-fade-in-up">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ margin: '0 0 4px 0', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                                    <h2 style={{ margin: '12px 0 0 0', fontSize: '2.5rem', lineHeight: 1, color: color, fontWeight: '800' }}>{value}</h2>
                                </div>
                                <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: soft, color, display: 'grid', placeItems: 'center', flex: '0 0 auto', border: `1px solid ${color}40` }}>
                                    <Icon size={22} strokeWidth={2.4} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Middle Row Charts */}
                <div className="analytics-chart-grid">

                    {/* SECTION 2: Warehouse Capacity */}
                    <div style={{...cardStyle, animationDelay: '0.5s'}} className="glass-card-hover animate-fade-in-up">
                        <h3 style={titleStyle}>Warehouse Capacity</h3>
                        <div style={chartShellStyle} className="notranslate">
                            {warehouseCapacityData.length > 0 ? (
                                <ResponsiveContainer>
                                    <AnimatedChart>
                                        <BarChart data={warehouseCapacityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#ff6b00" floodOpacity="0.3" />
                                                </filter>
                                                <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#86efac" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.8} />
                                                </linearGradient>
                                                <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#ffb693" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#ff6b00" stopOpacity={0.8} />
                                                </linearGradient>
                                                <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#ffb4ab" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#ff6b00" stopOpacity={0.8} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => val.split(' ')[0]} />
                                            <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => formatNumber(val)} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', backdropFilter: 'blur(8px)' }}
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

                    {/* NEW SECTION: Top Busiest Routes */}
                    <div style={{...cardStyle, animationDelay: '0.55s'}} className="glass-card-hover animate-fade-in-up">
                        <h3 style={titleStyle}>Top 5 Busiest Routes</h3>
                        <div style={chartShellStyle} className="notranslate">
                            {topRoutesData.length > 0 ? (
                                <ResponsiveContainer>
                                    <AnimatedChart>
                                        <BarChart data={topRoutesData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorRoutes" x1="0" y1="0" x2="1" y2="0">
                                                    <stop offset="0%" stopColor="#ffb961" stopOpacity={0.8} />
                                                    <stop offset="100%" stopColor="#ff6b00" stopOpacity={1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                                            <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} allowDecimals={false} />
                                            <YAxis dataKey="route" type="category" stroke="var(--text-secondary)" fontSize={10} width={120} tick={{ fill: 'var(--text-primary)' }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', backdropFilter: 'blur(8px)' }}
                                                formatter={(value) => [formatNumber(value), 'Orders']}
                                            />
                                            <Bar dataKey="orders" fill="url(#colorRoutes)" radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={1200}>
                                                {topRoutesData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={`url(#colorRoutes)`} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </AnimatedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={emptyStateStyle}>No route data available</div>
                            )}
                        </div>
                    </div>

                    {/* SECTION 7: Inbound vs Outbound */}
                    <div style={{...cardStyle, animationDelay: '0.6s'}} className="glass-card-hover animate-fade-in-up">
                        <h3 style={titleStyle}>Inbound vs Outbound Volume</h3>
                        <div style={chartShellStyle} className="notranslate">
                            {ioData.length > 0 ? (
                                <ResponsiveContainer>
                                    <AnimatedChart>
                                        <BarChart data={ioData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <filter id="glowInOut" x="-20%" y="-20%" width="140%" height="140%">
                                                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#ff6b00" floodOpacity="0.2" />
                                                </filter>
                                                <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#ffddb9" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#ffb961" stopOpacity={0.8} />
                                                </linearGradient>
                                                <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#ffb77f" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#ff6b00" stopOpacity={0.8} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => val?.split(' ')[0] || val} />
                                            <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => formatNumber(val)} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', backdropFilter: 'blur(8px)' }}
                                                formatter={(value, name, props) => [`${formatNumber(value)} (${t('On hand')}: ${formatNumber(props.payload.onhand)})`, name]}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }} />
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
                    
                    {/* NEW SECTION: Reroute Frequency */}
                    <div style={{...cardStyle, animationDelay: '0.65s'}} className="glass-card-hover animate-fade-in-up">
                        <h3 style={{ ...titleStyle, display: 'flex', alignItems: 'center', gap: '8px' }}><Route size={18} /> Reroute Frequency (30D)</h3>
                        <div style={chartShellStyle} className="notranslate">
                            {rerouteFrequencyData.length > 0 ? (
                                <ResponsiveContainer>
                                    <AnimatedChart>
                                        <AreaChart data={rerouteFrequencyData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorRerouteArea" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#ff6b00" stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor="#ff6b00" stopOpacity={0.0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickFormatter={(val) => val.slice(5)} />
                                            <YAxis stroke="var(--text-secondary)" fontSize={12} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', backdropFilter: 'blur(8px)' }}
                                                formatter={(value) => [formatNumber(value), 'Reroutes']}
                                            />
                                            <Area type="monotone" dataKey="count" stroke="#ffb693" strokeWidth={3} fill="url(#colorRerouteArea)" dot={{ r: 4, fill: '#ff6b00', strokeWidth: 2, stroke: '#0f131d' }} isAnimationActive={true} animationDuration={1200} />
                                        </AreaChart>
                                    </AnimatedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={emptyStateStyle}>No reroutes in the last 30 days</div>
                            )}
                        </div>
                    </div>
                    {/* SECTION 3: Order Status */}
                    <div style={{...cardStyle, animationDelay: '0.7s'}} className="glass-card-hover animate-fade-in-up">
                        <h3 style={titleStyle}>Order Status Distribution</h3>
                        <div style={{ ...chartShellStyle, height: 280 }} className="notranslate">
                            {orderStatusData.length > 0 ? (
                                <ResponsiveContainer>
                                    <AnimatedChart>
                                        <PieChart>
                                            <Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={54} outerRadius={94} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${formatNumber(Math.round(percent * 100))}%`} isAnimationActive={true} animationDuration={1200} stroke="rgba(0,0,0,0.2)">
                                                {orderStatusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={['#ff6b00', '#ffb693', '#ffb961', '#ffb4ab', '#e2bfb0'][index % 5]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', backdropFilter: 'blur(8px)' }}
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

                    {/* SECTION: Payment Collection */}
                    <div style={{...cardStyle, animationDelay: '0.75s'}} className="glass-card-hover animate-fade-in-up">
                        <h3 style={titleStyle}>Payment Collection Status</h3>
                        <div style={{ ...chartShellStyle, height: 280 }} className="notranslate">
                            {paymentStatusData.length > 0 ? (
                                <ResponsiveContainer>
                                    <AnimatedChart>
                                        <PieChart>
                                            <Pie data={paymentStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={94} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${formatNumber(Math.round(percent * 100))}%`} isAnimationActive={true} animationDuration={1200} stroke="rgba(0,0,0,0.2)">
                                                {paymentStatusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={['#86efac', '#ffb961', '#ffb4ab'][index % 3]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', backdropFilter: 'blur(8px)' }}
                                                formatter={(value, name) => [formatNumber(value), name]}
                                            />
                                        </PieChart>
                                    </AnimatedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={emptyStateStyle}>No payment data available</div>
                            )}
                        </div>
                    </div>

                    {/* SECTION: Fleet Status */}
                    <div style={{...cardStyle, animationDelay: '0.8s'}} className="glass-card-hover animate-fade-in-up">
                        <h3 style={titleStyle}>Fleet Status</h3>
                        <div style={{ ...chartShellStyle, height: 280 }} className="notranslate">
                            {data.fleet.length > 0 ? (
                                <ResponsiveContainer>
                                    <AnimatedChart>
                                        <PieChart>
                                            <Pie data={fleetDonutData} cx="50%" cy="50%" innerRadius={64} outerRadius={94} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${formatNumber(Math.round(percent * 100))}%`} isAnimationActive={true} animationDuration={1200} stroke="rgba(0,0,0,0.2)">
                                                {fleetDonutData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={['#ff6b00', 'var(--border-color)'][index % 2]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', backdropFilter: 'blur(8px)' }}
                                                formatter={(value, name) => [formatNumber(value), name]}
                                            />
                                            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="var(--text-primary)" fontSize={26} fontWeight="bold">
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
            </div>
        </div>
    );
};

export default AnalyticsPage;