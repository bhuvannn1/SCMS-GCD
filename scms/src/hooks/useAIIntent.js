export const detectIntent = (message) => {
    if (!message || typeof message !== 'string') return "all";

    // Convert message to lowercase for case-insensitive matching
    const msg = message.toLowerCase();

    // Define the keyword categories exactly as requested
    const categories = {
        warehouses: ["warehouse", "capacity", "inventory", "stock"],
        orders: ["order", "delivery", "load", "eta", "customer", "pickup"],
        logs: ["logs", "activity", "happened", "history", "alerts"],
        fleet: ["fleet", "truck", "vehicle", "status", "tracking"],
        drivers: ["driver", "rating", "trip", "active", "inactive"],
        payments: ["payment", "invoice", "money", "transaction", "billing"],
        reroutes: ["reroute", "divert", "change route"]
    };

    const matchedCategories = [];

    // Check which categories have at least one keyword present in the message
    for (const [intent, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => msg.includes(keyword))) {
            matchedCategories.push(intent);
        }
    }

    // Default to "all" if nothing matched
    if (matchedCategories.length === 0) {
        return "all";
    }

    // If exactly one category matched, return it
    if (matchedCategories.length === 1) {
        return matchedCategories[0];
    }

    // If multiple keywords from DIFFERENT categories matched, return "all"
    return "all";
};

const useAIIntent = () => {
    return { detectIntent };
};

export default useAIIntent;
