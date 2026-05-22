const { PlaidApi, PlaidEnvironments, Configuration } = require('plaid');

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

async function createLinkToken(userId) {
  // TODO: add webhook URL and products as needed
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Budget App',
    products: ['transactions'],
    country_codes: ['US'],
    language: 'en',
  });

  return response.data.link_token;
}

async function exchangePublicToken(publicToken) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

async function syncTransactions(accessToken, cursor) {
  const response = await plaidClient.transactionsSync({
    access_token: accessToken,
    ...(cursor && { cursor }),
  });

  return {
    added: response.data.added,
    modified: response.data.modified,
    removed: response.data.removed,
    nextCursor: response.data.next_cursor,
    hasMore: response.data.has_more,
  };
}

module.exports = { createLinkToken, exchangePublicToken, syncTransactions };
