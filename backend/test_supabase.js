const axios = require('axios');
(async () => {
  const url = 'https://xpjomwvpnbaxshujrmmg.supabase.co/rest/v1/?apikey=sb_publishable_2-MdwoZF3a_47KWS80vXTw_w1ZJuoB1';
  try {
      const res = await axios.get(url);
      const schema = res.data.definitions.truck_reroutes.properties;
      console.log('Columns:', Object.keys(schema));
  } catch(e) {
      console.error(e.message);
  }
})();
