import React, { useState, useRef, useEffect } from 'react';
import { detectIntent } from '../hooks/useAIIntent';
import supabase from '../config/SupabaseClient';
import { GoogleGenerativeAI } from "@google/generative-ai";

const RobotIcon = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Orange background circle */}
        <circle cx="12" cy="12" r="10" fill="#f97316" />

        {/* Red side antennas/ears */}
        <rect x="5.5" y="9.5" width="1.5" height="5" rx="0.75" fill="#ef4444" />
        <rect x="17" y="9.5" width="1.5" height="5" rx="0.75" fill="#ef4444" />
        <path d="M6 11h1.5M16.5 11h1" stroke="#ef4444" strokeWidth="1" />

        {/* Yellow top antenna/cap */}
        <path d="M10 7.5c0-1 1-1.5 2-1.5s2 .5 2 1.5H10z" fill="#facc15" />

        {/* White robot head main body */}
        <rect x="7" y="7.5" width="10" height="9" rx="3.5" fill="#ffffff" />
        <rect x="7.25" y="7.75" width="9.5" height="8.5" rx="3.25" stroke="#cbd5e1" strokeWidth="0.5" fill="none" />

        {/* Visor */}
        <rect x="8.5" y="9.5" width="7" height="4" rx="1.5" fill="#1e293b" />

        {/* Glowing Eyes */}
        <circle cx="10.25" cy="11.5" r="0.8" fill="#38bdf8" />
        <circle cx="13.75" cy="11.5" r="0.8" fill="#38bdf8" />

        {/* Mouth */}
        <rect x="11" y="14.5" width="2" height="0.8" rx="0.4" fill="#64748b" />
    </svg>
);

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const AIAssistant = () => {
    const genAI = new GoogleGenerativeAI(
        process.env.REACT_APP_GEMINI_API_KEY
    );
    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite-preview"
    });
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Hello! I am your SCMS Co-Pilot. How can I help you manage your supply chain today?', timestamp: new Date() }
    ]);
    const [userId, setUserId] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [sessionsList, setSessionsList] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const recognitionRef = useRef(null);

    const messagesEndRef = useRef(null);

    const suggestionsMap = {
        seller: [
            "Warehouse status",
            "Driver availability",
            "Today's summary",
            "Order overview"
        ],
        owner: [
            "Warehouse status",
            "Driver availability",
            "Today's summary",
            "Order overview"
        ],
        buyer: [
            "My purchases",
            "Tracking details",
            "How do I pay?",
            "Add destination warehouse"
        ],
        driver: [
            "Assigned loads",
            "Earnings summary",
            "How do I set status?",
            "Upload delivery proof"
        ]
    };
    const suggestions = suggestionsMap[userRole] || suggestionsMap.seller;

    const generateUUID = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : ((r & 0x3) | 0x8);
            return v.toString(16);
        });
    };

    const loadSession = async (sId) => {
        setCurrentSessionId(sId);
        setLoading(true);
        let query = supabase.from('chat_history').select('*');
        if (sId === '00000000-0000-0000-0000-000000000000') {
            query = query.or('session_id.is.null,session_id.eq.00000000-0000-0000-0000-000000000000');
        } else {
            query = query.eq('session_id', sId);
        }
        const { data, error } = await query.order('created_at', { ascending: true });
        setLoading(false);
        if (error) {
            console.error("Failed to load session messages:", error);
        } else if (data && data.length > 0) {
            setMessages(data.map(h => ({
                role: h.role,
                text: h.text,
                timestamp: new Date(h.created_at)
            })));
        } else {
            setMessages([
                { role: 'ai', text: 'Hello! I am your SCMS Co-Pilot. How can I help you manage your supply chain today?', timestamp: new Date() }
            ]);
        }
    };

    const startNewChat = () => {
        const newId = generateUUID();
        setCurrentSessionId(newId);
        setMessages([
            { role: 'ai', text: 'Hello! I am your SCMS Co-Pilot. How can I help you manage your supply chain today?', timestamp: new Date() }
        ]);
    };

    const refreshSessionsList = async (uId = userId) => {
        if (!uId) return;
        try {
            const { data, error } = await supabase
                .from('chat_history')
                .select('session_id, role, text, created_at')
                .eq('user_id', uId)
                .order('created_at', { ascending: true });
            if (error) {
                console.error("Error refreshing sessions list:", error);
                return;
            }
            const groups = {};
            data.forEach(h => {
                const sId = h.session_id || '00000000-0000-0000-0000-000000000000';
                if (!groups[sId]) groups[sId] = [];
                groups[sId].push(h);
            });
            const list = Object.keys(groups).map(sId => {
                const msgs = groups[sId];
                const firstUserMsg = msgs.find(m => m.role === 'user');
                const title = firstUserMsg ? (firstUserMsg.text.length > 22 ? firstUserMsg.text.substring(0, 22) + '...' : firstUserMsg.text) : 'Previous Chat';
                const lastMsg = msgs[msgs.length - 1];
                return {
                    sessionId: sId,
                    title: title,
                    updatedAt: new Date(lastMsg.created_at)
                };
            }).sort((a, b) => b.updatedAt - a.updatedAt);
            setSessionsList(list);
        } catch (err) {
            console.error("Error refreshing sessions list:", err);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    useEffect(() => {
        const fetchSessionAndHistory = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const uId = session.user.id;
                    setUserId(uId);

                    // Fetch user role
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', uId)
                        .maybeSingle();
                    const currentRole = profileData?.role || session.user.user_metadata?.role || 'seller';
                    setUserRole(currentRole);

                    // Fetch history from Supabase
                    const { data: historyData, error } = await supabase
                        .from('chat_history')
                        .select('session_id, role, text, created_at')
                        .eq('user_id', uId)
                        .order('created_at', { ascending: true });

                    if (error) {
                        console.error("Failed to fetch chat history:", error);
                        const newId = generateUUID();
                        setCurrentSessionId(newId);
                    } else if (historyData && historyData.length > 0) {
                        const groups = {};
                        historyData.forEach(h => {
                            const sId = h.session_id || '00000000-0000-0000-0000-000000000000';
                            if (!groups[sId]) groups[sId] = [];
                            groups[sId].push(h);
                        });
                        const list = Object.keys(groups).map(sId => {
                            const msgs = groups[sId];
                            const firstUserMsg = msgs.find(m => m.role === 'user');
                            const title = firstUserMsg ? (firstUserMsg.text.length > 22 ? firstUserMsg.text.substring(0, 22) + '...' : firstUserMsg.text) : 'Previous Chat';
                            const lastMsg = msgs[msgs.length - 1];
                            return {
                                sessionId: sId,
                                title: title,
                                updatedAt: new Date(lastMsg.created_at)
                            };
                        }).sort((a, b) => b.updatedAt - a.updatedAt);

                        setSessionsList(list);
                        if (list.length > 0) {
                            const activeId = list[0].sessionId;
                            setCurrentSessionId(activeId);
                            setMessages(groups[activeId].map(h => ({
                                role: h.role,
                                text: h.text,
                                timestamp: new Date(h.created_at)
                            })));
                        } else {
                            const newId = generateUUID();
                            setCurrentSessionId(newId);
                        }
                    } else {
                        const newId = generateUUID();
                        setCurrentSessionId(newId);
                    }
                }
            } catch (err) {
                console.error("Session fetching error:", err);
            }
        };
        fetchSessionAndHistory();
    }, []);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            setSpeechSupported(true);
            const rec = new SpeechRecognition();
            rec.continuous = false;
            rec.interimResults = false;

            rec.onstart = () => {
                setIsListening(true);
            };

            rec.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
            };

            rec.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            rec.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = rec;
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            const langMap = {
                'en': 'en-IN',
                'hi': 'hi-IN',
                'ta': 'ta-IN',
                'te': 'te-IN',
                'kn': 'kn-IN',
                'ml': 'ml-IN',
                'mr': 'mr-IN',
                'gu': 'gu-IN',
                'pa': 'pa-IN',
                'bn': 'bn-IN',
                'ur': 'ur-IN'
            };

            let targetLang = 'en';

            // 1. Try reading selected option from Google Translate select dropdown
            const selectEl = document.querySelector('.goog-te-combo');
            if (selectEl && selectEl.value) {
                targetLang = selectEl.value;
            } else {
                // 2. Try reading from googtrans cookie
                const match = document.cookie.match(/googtrans=([^;]+)/);
                if (match) {
                    const parts = match[1].split('/');
                    targetLang = parts[parts.length - 1];
                }
            }

            recognitionRef.current.lang = langMap[targetLang] || 'en-IN';

            try {
                recognitionRef.current.start();
            } catch (err) {
                console.error("Failed to start speech recognition:", err);
            }
        }
    };

    const formatTimeAgo = (timestamp) => {
        const minutesAgo = Math.floor((new Date() - new Date(timestamp)) / 60000);
        if (minutesAgo === 0) return 'Just now';
        if (minutesAgo === 1) return '1 min ago';
        if (minutesAgo < 60) return minutesAgo + ' mins ago';
        const hoursAgo = Math.floor(minutesAgo / 60);
        return hoursAgo + ' hours ago';
    };

    const formatMessageText = (text) => {
        // Very basic markdown list parsing for bullet points
        if (text.includes('- ') || text.includes('* ')) {
            const lines = text.split('\n');
            const formattedLines = [];
            let inList = false;

            lines.forEach((line) => {
                const trimmed = line.trim();
                // Check if the line is a list item
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    if (!inList) {
                        formattedLines.push('<ul style="margin: 8px 0; padding-left: 20px;">');
                        inList = true;
                    }
                    // Extract the text after the bullet point
                    const bulletText = trimmed.substring(2);
                    // Bold text formatting **text** inside the bullet
                    const boldParsed = bulletText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    formattedLines.push(`<li>${boldParsed}</li>`);
                } else {
                    if (inList) {
                        formattedLines.push('</ul>');
                        inList = false;
                    }
                    if (trimmed) {
                        // Bold text formatting outside bullets
                        const boldParsed = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                        formattedLines.push(`<p style="margin: 0 0 8px 0;">${boldParsed}</p>`);
                    }
                }
            });
            if (inList) formattedLines.push('</ul>');
            return <div dangerouslySetInnerHTML={{ __html: formattedLines.join('') }} />;
        }

        // Just parse bold text if no lists
        const boldParsed = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <p style={{ margin: 0, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: boldParsed }} />;
    };

    const handleSend = async (textToSend = input) => {
        const messageText = textToSend.trim();
        if (!messageText) return;

        // 1. Add user message
        const newUserMsg = { role: 'user', text: messageText, timestamp: new Date() };
        setMessages(prev => [...prev, newUserMsg]);
        setInput('');
        setLoading(true);

        // Save user message to Supabase
        if (userId) {
            try {
                const { error } = await supabase.from('chat_history').insert([{
                    user_id: userId,
                    role: 'user',
                    text: messageText,
                    session_id: currentSessionId,
                    created_at: new Date()
                }]);
                if (error) throw error;
                refreshSessionsList(userId);
            } catch (err) {
                console.error("Failed to save user message to history:", err);
            }
        }

        try {
            // 2. Call detectIntent
            const intent = detectIntent(messageText);

            // 3. Fetch context directly from Supabase with role-based scoping
            let contextData = {};
            try {
                if (userRole === "buyer") {
                    // Fetch Buyer's orders
                    const { data: buyerOrders } = await supabase.from("Load").select("*").eq("buyer_id", userId);
                    const ordersList = buyerOrders || [];
                    const fleetIds = ordersList.map(o => o.fleet_id).filter(Boolean);
                    const orderIds = ordersList.map(o => o.load_id).filter(Boolean);

                    if (intent === "orders") {
                        contextData = { orders: ordersList };
                    } else if (intent === "fleet") {
                        let fleet = [];
                        if (fleetIds.length > 0) {
                            const { data } = await supabase.from("Fleet").select("*").in("id", fleetIds);
                            fleet = data || [];
                        }
                        contextData = { fleet };
                    } else if (intent === "warehouses") {
                        let warehouses = [];
                        try {
                            const res = await fetch(`${API}/api/buyer-warehouses?buyer_id=${userId}`);
                            if (res.ok) {
                                const data = await res.json();
                                warehouses = data.warehouses || [];
                            }
                        } catch (e) {
                            console.error(e);
                        }
                        contextData = { warehouses };
                    } else if (intent === "payments") {
                        let payments = [];
                        if (orderIds.length > 0) {
                            const { data } = await supabase.from("payments").select("*").in("order_id", orderIds);
                            payments = data || [];
                        }
                        contextData = { payments };
                    } else if (intent === "reroutes") {
                        let reroutes = [];
                        if (fleetIds.length > 0) {
                            const { data } = await supabase.from("truck_reroutes").select("*").in("fleet_id", fleetIds);
                            reroutes = data || [];
                        }
                        contextData = { reroutes };
                    } else {
                        // Fetch all relevant buyer data for "all" or general queries
                        let fleet = [], payments = [], warehouses = [];
                        if (fleetIds.length > 0) {
                            const { data } = await supabase.from("Fleet").select("*").in("id", fleetIds);
                            fleet = data || [];
                        }
                        if (orderIds.length > 0) {
                            const { data } = await supabase.from("payments").select("*").in("order_id", orderIds);
                            payments = data || [];
                        }
                        try {
                            const res = await fetch(`${API}/api/buyer-warehouses?buyer_id=${userId}`);
                            if (res.ok) {
                                const data = await res.json();
                                warehouses = data.warehouses || [];
                            }
                        } catch (e) {}

                        contextData = {
                            orders: ordersList,
                            fleet,
                            payments,
                            warehouses
                        };
                    }
                } else if (userRole === "driver") {
                    // Fetch Driver's assigned loads
                    const { data: driverOrders } = await supabase.from("Load").select("*").eq("driver_id", userId);
                    const ordersList = driverOrders || [];

                    // Fetch Driver's assigned fleet/vehicle
                    const { data: fleetRow } = await supabase.from("Fleet").select("*").eq("driver_id", userId).maybeSingle();

                    if (intent === "orders") {
                        contextData = { orders: ordersList };
                    } else if (intent === "fleet") {
                        contextData = { fleet: fleetRow ? [fleetRow] : [] };
                    } else if (intent === "drivers") {
                        const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
                        const { data: driverMeta } = await supabase.from("driver").select("*").eq("id", userId).maybeSingle();
                        const { data: earnings } = await supabase.from("driver_earnings").select("*").eq("driver_id", userId);
                        contextData = {
                            profile: profile || {},
                            driver_metadata: driverMeta || {},
                            earnings: earnings || []
                        };
                    } else if (intent === "reroutes") {
                        let reroutes = [];
                        if (fleetRow?.id) {
                            const { data } = await supabase.from("truck_reroutes").select("*").eq("fleet_id", fleetRow.id);
                            reroutes = data || [];
                        }
                        contextData = { reroutes };
                    } else {
                        // Fetch general summary of assigned items for "all"
                        const { data: earnings } = await supabase.from("driver_earnings").select("*").eq("driver_id", userId);
                        contextData = {
                            orders: ordersList,
                            fleet: fleetRow ? [fleetRow] : [],
                            earnings: earnings || []
                        };
                    }
                } else {
                    // Seller / Owner (Original full access queries)
                    if (intent === "warehouses") {
                        const { data } = await supabase.from("warehouses").select("*");
                        contextData = { warehouses: data || [] };
                    } else if (intent === "orders") {
                        const { data } = await supabase.from("Load").select("*").limit(30);
                        contextData = { orders: data || [] };
                    } else if (intent === "logs") {
                        const { data } = await supabase.from("warehouse_logs").select("*").limit(15);
                        contextData = { logs: data || [] };
                    } else if (intent === "fleet") {
                        const { data } = await supabase.from("Fleet").select("*");
                        contextData = { fleet: data || [] };
                    } else if (intent === "drivers") {
                        const { data } = await supabase.from("driver").select("*");
                        const { data: eData } = await supabase.from("driver_earnings").select("*").limit(10);
                        contextData = { drivers: data || [], driver_earnings_sample: eData || [] };
                    } else if (intent === "payments") {
                        const { data } = await supabase.from("payments").select("*").limit(20);
                        contextData = { payments: data || [] };
                    } else if (intent === "reroutes") {
                        const { data } = await supabase.from("truck_reroutes").select("*");
                        contextData = { reroutes: data || [] };
                    } else if (intent === "all") {
                        const [w, l, f, d, p] = await Promise.all([
                            supabase.from("warehouses").select("*"),
                            supabase.from("Load").select("*").limit(10),
                            supabase.from("Fleet").select("*"),
                            supabase.from("driver").select("*"),
                            supabase.from("payments").select("*").limit(5)
                        ]);
                        contextData = {
                            warehouses: w.data || [],
                            recentOrders: l.data || [],
                            fleetStatus: f.data || [],
                            drivers: d.data || [],
                            recentPayments: p.data || []
                        };
                    }
                }
            } catch (err) {
                console.error("Supabase fetch error:", err);
                contextData = { error: "Failed to fetch live data" };
            }

            // 4. Build the Gemini prompt with App Guidebook & Role Enforcement
            const APP_GUIDE = `
SCMS App Usage Guidebook:
- Buyer Portal Features:
  1. Purchases/Orders: View all your purchases in the "My Purchases" tab. For unpaid orders, you can click the orange "Pay Now" button to make a payment.
  2. Invoices: Download invoices for paid orders from the "Invoices" tab.
  3. Destination Warehouses: Add and manage the warehouses where you want goods delivered in the "My Warehouses" tab. Marking one as primary/default sets it as the preferred drop destination.
  4. Live Tracking: Track the real-time location and optimized route of active delivery trucks in the "Tracking" tab.
- Driver Portal Features:
  1. Onboarding/Profile: Fill in your Driver Name, Phone, License, and Vehicle details in the "Driver Hub" to activate your account.
  2. Toggle Active Status: Switch your status between "Active" (available for assignments) and "Not Active" (or "On Trip" and "On Break" during a journey) by tapping the status button in the Driver Hub header.
  3. Assigned Loads: View details of all orders assigned to you under the "Assigned Loads" tab.
  4. Google Maps Routing: Tap the "Navigate" button next to any assigned load to open driving directions in Google Maps.
  5. Upload Proof of Delivery: Upload proof files (images/documents) directly under the assigned loads tab once a delivery is completed.
  6. Track Earnings: Check your earnings breakdown in the Driver Hub and "Earnings" tab.
`;

            const prompt = `
   You are SCMS Co-Pilot, an AI assistant for a supply chain 
   management system in India.
   
   The user's role is: ${userRole || 'buyer'}
   
   Context data (scoped specifically to this user): ${JSON.stringify(contextData)}
   
   App usage guidebook:
   ${APP_GUIDE}
   
   User question: ${messageText}
   
   Rules:
   - If they ask how to use the app or how to complete tasks, guide them clearly using the App usage guidebook.
   - Give a direct one-line answer first.
   - Then bullet points with details.
   - End with one role-specific recommendation.
   - Keep under 150 words.
   - Only use data from context and the guidebook. Do not make up orders or fleets.
   - If no relevant data exists in the context or guidebook, say: I don't have enough data for that.
   `;

            // 5. Call Gemini directly
            const result = await model.generateContent(prompt);
            const reply = result.response.text();

            // 6. Add AI reply
            setMessages(prev => [...prev, { role: 'ai', text: reply, timestamp: new Date() }]);

            // Save AI reply to Supabase
            if (userId) {
                try {
                    const { error } = await supabase.from('chat_history').insert([{
                        user_id: userId,
                        role: 'ai',
                        text: reply,
                        session_id: currentSessionId,
                        created_at: new Date()
                    }]);
                    if (error) throw error;
                    refreshSessionsList(userId);
                } catch (err) {
                    console.error("Failed to save AI reply to history:", err);
                }
            }

        } catch (error) {
            console.error("AI Assistant Error:", error);
            const errorReply = "AI error: " + error.message;
            setMessages(prev => [...prev, {
                role: 'ai',
                text: errorReply,
                timestamp: new Date(),
                isError: true
            }]);

            // Save AI error to Supabase
            if (userId) {
                try {
                    const { error } = await supabase.from('chat_history').insert([{
                        user_id: userId,
                        role: 'ai',
                        text: errorReply,
                        session_id: currentSessionId,
                        created_at: new Date()
                    }]);
                    if (error) throw error;
                    refreshSessionsList(userId);
                } catch (err) {
                    console.error("Failed to save AI error reply to history:", err);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div style={{
            display: 'flex',
            height: '100%',
            width: '100%',
            backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.85))',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            fontFamily: "'Nunito', system-ui, -apple-system, sans-serif",
            color: 'var(--text-primary, #1e293b)',
            border: 'none',
            borderRadius: '16px',
            overflow: 'hidden'
        }}>
            {/* Collapsible Left History Sidebar */}
            <div style={{
                width: isSidebarOpen ? '260px' : '0px',
                display: 'flex',
                flexDirection: 'column',
                borderRight: isSidebarOpen ? '1px solid var(--border-color, rgba(249, 115, 22, 0.2))' : 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                flexShrink: 0
            }}>
                {/* Sidebar Header: New Chat */}
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-color, rgba(249, 115, 22, 0.2))' }}>
                    <button
                        onClick={startNewChat}
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            color: 'white',
                            border: 'none',
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.25)',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        New Chat
                    </button>
                </div>

                {/* Sidebar Sessions List */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                }} className="sidebar-scroll">
                    {sessionsList.map(s => {
                        const isActive = s.sessionId === currentSessionId;
                        return (
                            <button
                                key={s.sessionId}
                                onClick={() => loadSession(s.sessionId)}
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: '10px',
                                    border: isActive ? '1px solid var(--accent, #f97316)' : '1px solid transparent',
                                    backgroundColor: isActive ? 'var(--accent-bg, rgba(249, 115, 22, 0.1))' : 'transparent',
                                    color: isActive ? 'var(--accent, #f97316)' : 'var(--text-primary, #1e293b)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '0.85rem',
                                    fontWeight: '600'
                                }}
                                onMouseOver={(e) => {
                                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.05)';
                                }}
                                onMouseOut={(e) => {
                                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                    {s.title}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Chat Area */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                backgroundColor: 'transparent'
            }}>
                {/* Top Bar */}
                <div style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid var(--border-color, rgba(249, 115, 22, 0.2))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {/* Toggle Sidebar Button */}
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary, #64748b)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '6px',
                                borderRadius: '8px',
                                transition: 'all 0.2s',
                                outline: 'none'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent, #f97316)'}
                            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary, #64748b)'}
                            title={isSidebarOpen ? "Hide chat history" : "Show chat history"}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                            </svg>
                        </button>

                        <RobotIcon size={42} />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--accent, #f97316)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                IGNIS Co-Pilot
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span style={{
                                    width: '8px',
                                    height: '8px',
                                    backgroundColor: '#10b981',
                                    borderRadius: '50%',
                                    display: 'inline-block',
                                    boxShadow: '0 0 8px #10b981',
                                    animation: 'pulse-mic 2s infinite'
                                }} />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)', fontWeight: '600' }}>Active & Ready</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages Area */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    scrollBehavior: 'smooth',
                    backgroundColor: 'transparent'
                }} className="chat-messages-container">
                    {messages.map((msg, idx) => (
                        <div key={idx} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                        }}>
                            <div style={{
                                display: 'flex',
                                gap: '12px',
                                maxWidth: '82%',
                                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                alignItems: 'flex-start'
                            }}>
                                {/* Avatar */}
                                {msg.role === 'ai' && (
                                    <div style={{ flexShrink: 0 }}>
                                        <RobotIcon size={36} />
                                    </div>
                                )}

                                {/* Bubble */}
                                <div style={{
                                    backgroundColor: msg.role === 'user' ? 'var(--accent, #f97316)' : (msg.isError ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-primary, #f8fafc)'),
                                    backgroundImage: msg.role === 'user' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'none',
                                    padding: '14px 18px',
                                    borderRadius: '16px',
                                    borderTopLeftRadius: msg.role === 'ai' ? '4px' : '16px',
                                    borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                                    color: msg.role === 'user' ? 'white' : (msg.isError ? '#ef4444' : 'var(--text-primary, #1e293b)'),
                                    fontSize: '0.95rem',
                                    lineHeight: '1.6',
                                    boxShadow: msg.role === 'user' ? '0 4px 12px rgba(249, 115, 22, 0.25)' : 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
                                    border: msg.role === 'ai' ? '1px solid var(--border-color, rgba(249, 115, 22, 0.15))' : 'none',
                                    wordBreak: 'break-word'
                                }}>
                                    {formatMessageText(msg.text)}
                                </div>
                            </div>
                            {/* Timestamp */}
                            <span style={{
                                fontSize: '0.725rem',
                                color: 'var(--text-secondary, #94a3b8)',
                                marginTop: '6px',
                                marginRight: msg.role === 'user' ? '6px' : '0',
                                marginLeft: msg.role === 'ai' ? '48px' : '0',
                                fontWeight: '600'
                            }}>
                                {formatTimeAgo(msg.timestamp)}
                            </span>
                        </div>
                    ))}

                    {/* Loading State */}
                    {loading && (
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ flexShrink: 0 }}>
                                <RobotIcon size={36} />
                            </div>
                            <div style={{
                                backgroundColor: 'var(--bg-primary, #f8fafc)',
                                padding: '16px 20px',
                                borderRadius: '16px',
                                borderTopLeftRadius: '4px',
                                display: 'flex',
                                gap: '6px',
                                alignItems: 'center',
                                border: '1px solid var(--border-color, rgba(249, 115, 22, 0.15))',
                                boxShadow: 'var(--shadow-sm)'
                            }}>
                                <div className="typing-dot" style={{ animationDelay: '0s' }}></div>
                                <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                                <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Bottom Input Area */}
                <div style={{
                    padding: '20px 24px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderTop: '1px solid var(--border-color, rgba(249, 115, 22, 0.2))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    {/* Suggestions */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {suggestions.map(s => {
                            let emoji = '💬';
                            if (s.includes('Warehouse')) emoji = '🏪';
                            if (s.includes('Driver')) emoji = '🚚';
                            if (s.includes('summary')) emoji = '📊';
                            if (s.includes('Order')) emoji = '📦';
                            return (
                                <button
                                    key={s}
                                    onClick={() => handleSend(s)}
                                    style={{
                                        backgroundColor: 'var(--bg-primary, #f8fafc)',
                                        border: '1px solid var(--border-color, rgba(249, 115, 22, 0.25))',
                                        color: 'var(--text-primary, #1e293b)',
                                        padding: '8px 14px',
                                        borderRadius: '20px',
                                        fontSize: '0.825rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.25s ease',
                                        whiteSpace: 'nowrap',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: 'var(--shadow-sm)'
                                    }}
                                    className="suggestion-chip"
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--accent, #f97316)';
                                        e.currentTarget.style.backgroundColor = 'var(--accent-bg, rgba(249, 115, 22, 0.1))';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border-color, rgba(249, 115, 22, 0.25))';
                                        e.currentTarget.style.backgroundColor = 'var(--bg-primary, #f8fafc)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    <span>{emoji}</span>
                                    <span>{s}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Capsule Input Bar */}
                    <div style={{
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                        backgroundColor: 'var(--bg-input, #ffffff)',
                        border: '1px solid var(--border-input, #cbd5e1)',
                        borderRadius: '30px',
                        padding: '6px 8px 6px 16px',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'all 0.2s ease',
                        width: '100%',
                        boxSizing: 'border-box'
                    }} className="capsule-input-bar">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isListening ? "Listening..." : "Ask about your supply chain..."}
                            style={{
                                flex: 1,
                                backgroundColor: 'transparent',
                                border: 'none',
                                padding: '8px 0',
                                color: 'var(--text-input, #1e293b)',
                                fontSize: '0.95rem',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {speechSupported && (
                                <button
                                    onClick={toggleListening}
                                    style={{
                                        backgroundColor: isListening ? '#ef4444' : 'transparent',
                                        border: 'none',
                                        color: isListening ? 'white' : 'var(--text-secondary, #64748b)',
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s ease',
                                        animation: isListening ? 'pulse-mic 1.5s infinite' : 'none'
                                    }}
                                    title={isListening ? "Listening... Click to stop" : "Speak to AI"}
                                >
                                    <svg
                                        style={{ width: '18px', height: '18px' }}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        strokeWidth="2.5"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                                    </svg>
                                </button>
                            )}
                            <button
                                onClick={() => handleSend()}
                                disabled={loading || !input.trim()}
                                style={{
                                    backgroundColor: (loading || !input.trim()) ? 'var(--border-input, #cbd5e1)' : 'var(--accent, #f97316)',
                                    color: 'white',
                                    border: 'none',
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: (loading || !input.trim()) ? 'none' : '0 2px 8px rgba(249, 115, 22, 0.25)'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS Keyframes for typing and microphone pulse animation */}
            <style>
                {`
                @keyframes typingBounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-6px); }
                }
                .typing-dot {
                    width: 8px;
                    height: 8px;
                    background-color: var(--text-secondary, #94a3b8);
                    border-radius: 50%;
                    animation: typingBounce 1.4s infinite ease-in-out both;
                }
                @keyframes pulse-mic {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
                    70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(249, 115, 22, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
                }
                .capsule-input-bar:focus-within {
                    border-color: var(--accent, #f97316) !important;
                    box-shadow: 0 0 0 2px var(--accent-bg, rgba(249, 115, 22, 0.15)) !important;
                }
                .chat-messages-container::-webkit-scrollbar,
                .sidebar-scroll::-webkit-scrollbar {
                    width: 6px;
                }
                .chat-messages-container::-webkit-scrollbar-track,
                .sidebar-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .chat-messages-container::-webkit-scrollbar-thumb,
                .sidebar-scroll::-webkit-scrollbar-thumb {
                    background: var(--border-color, rgba(249, 115, 22, 0.15));
                    border-radius: 10px;
                }
                .chat-messages-container::-webkit-scrollbar-thumb:hover,
                .sidebar-scroll::-webkit-scrollbar-thumb:hover {
                    background: var(--accent, #f97316);
                }
                `}
            </style>
        </div>
    );
};

export default AIAssistant;
