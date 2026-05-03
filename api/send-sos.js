export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phones, message } = req.body;

  if (!phones || !message) {
    return res.status(400).json({ error: 'Missing phones or message' });
  }

  const url = new URL('https://www.fast2sms.com/dev/bulkV2');
  url.searchParams.append('route', 'q');
  url.searchParams.append('message', message);
  url.searchParams.append('language', 'english');
  url.searchParams.append('flash', '0');
  url.searchParams.append('numbers', phones.join(','));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'authorization': process.env.FAST2SMS_API_KEY,
        'Cache-Control': 'no-cache'
      }
    });

    const data = await response.json();

    if (data.return === true) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(500).json({ success: false, error: data.message });
    }
  } catch (error) {
    console.error("SMS Error:", error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
