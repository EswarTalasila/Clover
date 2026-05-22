const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = [
  'Food & Dining',
  'Shopping',
  'Transportation',
  'Entertainment',
  'Bills & Utilities',
  'Health',
  'Travel',
  'Income',
  'Other',
];

async function categorizeTransaction(description, amount) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: `Categorize this transaction into exactly one of these categories: ${CATEGORIES.join(', ')}.

Transaction: "${description}", Amount: $${amount}

Reply with only the category name, nothing else.`,
      },
    ],
  });

  const raw = message.content[0].text.trim();
  const matched = CATEGORIES.find(
    (c) => c.toLowerCase() === raw.toLowerCase()
  );

  return matched || 'Other';
}

module.exports = { categorizeTransaction };
