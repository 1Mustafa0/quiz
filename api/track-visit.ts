export const config = {
  api: {
    bodyParser: true,
  },
};

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({ ok: true });
}
