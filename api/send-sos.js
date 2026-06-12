export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phones, message } = req.body;

  if (!phones || !message) {
    return res.status(400).json({ error: 'Missing phones or message' });
  }
  
  const results = [];
  
  for (const phone of phones) {
    try {
      let cleaned = phone.replace(/[\s\-+]/g, '');
      if (cleaned.startsWith('91') && cleaned.length === 12) {
        cleaned = cleaned.substring(2);
      }
      
      const response = await fetch('https://textbelt.com/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `+91${cleaned}`,
          message: message,
          key: 'textbelt' // Use 'textbelt' for free tier or provide a real key if needed
        })
      });
      
      const data = await response.json();
      console.log(`Textbelt Response for ${phone}:`, data);
      results.push({ phone, success: data.success, textId: data.textId });
    } catch (error) {
      console.error(`Textbelt Error for ${phone}:`, error.message);
      results.push({ phone, success: false, error: error.message });
    }
  }
  
  return res.status(200).json({ success: true, results });
}
