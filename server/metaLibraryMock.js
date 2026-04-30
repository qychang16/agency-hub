// Mock Meta Template Library data, matching Meta's actual API response shape.
// Sample templates pulled from Meta's official documentation:
// https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/template-library
//
// When credentials are configured and we want real Meta API calls, swap this
// module's exports for actual fetch calls to Meta's /message_template_library endpoint.

const SAMPLE_TEMPLATES = [
  {
    name: 'low_balance_warning_1',
    language: 'en_US',
    category: 'UTILITY',
    topic: 'PAYMENTS',
    usecase: 'LOW_BALANCE_WARNING',
    industry: ['FINANCIAL_SERVICES'],
    header: 'Your account balance is low',
    body: 'Hi {{1}},\nThis is to notify you that your {{2}} in your {{3}} account, ending in {{4}} is below your pre-set {{5}} of {{6}}.\nClick the button to deposit more {{7}}.\n{{8}}',
    body_params: ['Jim', 'available funds', 'CS Mutual checking plus', '1234', 'limit', '$75.00', 'funds', 'CS Mutual'],
    buttons: [
      { type: 'URL', text: 'Make a deposit', url: 'https://www.example.com/' },
      { type: 'PHONE_NUMBER', text: 'Call us', phone_number: '+18005551234' }
    ],
    id: '7147013345418927'
  },
  {
    name: 'delivery_update_1',
    language: 'en_US',
    category: 'UTILITY',
    topic: 'ORDER_MANAGEMENT',
    usecase: 'DELIVERY_UPDATE',
    industry: ['E_COMMERCE'],
    header: 'Delivery update',
    body: 'Hi {{1}}, your order {{2}} is on the way and will arrive on {{3}}. You can track it using the link below.',
    body_params: ['Jim', '#12345', 'Friday'],
    buttons: [{ type: 'URL', text: 'Track order', url: 'https://www.example.com/track/{{1}}' }],
    id: '7147013345418928'
  },
  {
    name: 'order_confirmation_1',
    language: 'en_US',
    category: 'UTILITY',
    topic: 'ORDER_MANAGEMENT',
    usecase: 'ORDER_CONFIRMATION',
    industry: ['E_COMMERCE'],
    header: 'Order confirmed',
    body: 'Hi {{1}}, thank you for your order. We have received your order {{2}} for {{3}} and it is being processed.',
    body_params: ['Jim', '#12345', 'a 12 pack of paper towels'],
    buttons: [{ type: 'URL', text: 'View order', url: 'https://www.example.com/order/{{1}}' }],
    id: '7147013345418929'
  },
  {
    name: 'appointment_reminder_1',
    language: 'en_US',
    category: 'UTILITY',
    topic: 'ACCOUNT_UPDATE',
    usecase: 'TRANSACTION_ALERT',
    industry: ['FINANCIAL_SERVICES'],
    header: 'Appointment reminder',
    body: 'Hi {{1}}, this is a reminder of your upcoming appointment with {{2}} on {{3}} at {{4}}.',
    body_params: ['Jim', 'CS Mutual', '2024-04-19', '3:00 PM'],
    buttons: [],
    id: '7147013345418930'
  },
  {
    name: 'payment_confirmation_1',
    language: 'en_US',
    category: 'UTILITY',
    topic: 'PAYMENTS',
    usecase: 'PAYMENT_CONFIRMATION',
    industry: ['FINANCIAL_SERVICES'],
    header: 'Payment confirmed',
    body: 'Hi {{1}}, your payment of {{2}} to {{3}} has been confirmed. Reference: {{4}}.',
    body_params: ['Jim', 'USD $375.32', 'CS Mutual', 'TXN-892341'],
    buttons: [],
    id: '7147013345418931'
  },
  {
    name: 'shipment_confirmation_1',
    language: 'en_US',
    category: 'UTILITY',
    topic: 'ORDER_MANAGEMENT',
    usecase: 'SHIPMENT_CONFIRMATION',
    industry: ['E_COMMERCE'],
    header: 'Shipment confirmed',
    body: 'Hi {{1}}, your order {{2}} has been shipped and is on its way to you. Estimated delivery: {{3}}.',
    body_params: ['Jim', '#12345', '2024-04-22'],
    buttons: [{ type: 'URL', text: 'Track shipment', url: 'https://www.example.com/track/{{1}}' }],
    id: '7147013345418932'
  },
  {
    name: 'feedback_survey_1',
    language: 'en_US',
    category: 'UTILITY',
    topic: 'CUSTOMER_FEEDBACK',
    usecase: 'FEEDBACK_SURVEY',
    industry: ['E_COMMERCE'],
    header: 'How did we do?',
    body: 'Hi {{1}}, thank you for your recent purchase. We would love to hear your feedback. Could you take a moment to rate your experience?',
    body_params: ['Jim'],
    buttons: [{ type: 'URL', text: 'Rate us', url: 'https://www.example.com/feedback/{{1}}' }],
    id: '7147013345418933'
  },
  {
    name: 'fraud_alert_1',
    language: 'en_US',
    category: 'UTILITY',
    topic: 'ACCOUNT_UPDATE',
    usecase: 'FRAUD_ALERT',
    industry: ['FINANCIAL_SERVICES'],
    header: 'Suspicious activity detected',
    body: 'Hi {{1}}, we detected unusual activity on your {{2}} account ending in {{3}}. If this was you, please confirm. If not, please contact us immediately.',
    body_params: ['Jim', 'savings', '4321'],
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirm it was me' },
      { type: 'PHONE_NUMBER', text: 'Call us', phone_number: '+18005551234' }
    ],
    id: '7147013345418934'
  }
]

// Filter mock library results based on query parameters that mirror Meta's API
function filterTemplates({ search, topic, usecase, industry, language, name } = {}) {
  let filtered = [...SAMPLE_TEMPLATES]

  if (language) {
    filtered = filtered.filter(t => t.language === language)
  }
  if (name) {
    filtered = filtered.filter(t => t.name === name)
  }
  if (topic) {
    filtered = filtered.filter(t => t.topic === topic)
  }
  if (usecase) {
    filtered = filtered.filter(t => t.usecase === usecase)
  }
  if (industry) {
    filtered = filtered.filter(t => Array.isArray(t.industry) && t.industry.includes(industry))
  }
  if (search) {
    const q = search.toLowerCase().replace(/^"|"$/g, '')
    filtered = filtered.filter(t => {
      const haystack = `${t.name} ${t.header || ''} ${t.body} ${t.usecase} ${t.topic}`.toLowerCase()
      return haystack.includes(q)
    })
  }

  return filtered
}

// Available filter values, matching Meta's documented enums
const AVAILABLE_FILTERS = {
  industries: ['E_COMMERCE', 'FINANCIAL_SERVICES'],
  topics: ['ACCOUNT_UPDATE', 'CUSTOMER_FEEDBACK', 'ORDER_MANAGEMENT', 'PAYMENTS'],
  usecases: [
    'ACCOUNT_CREATION_CONFIRMATION', 'AUTO_PAY_REMINDER', 'DELIVERY_CONFIRMATION',
    'DELIVERY_FAILED', 'DELIVERY_UPDATE', 'FEEDBACK_SURVEY', 'FRAUD_ALERT',
    'LOW_BALANCE_WARNING', 'ORDER_ACTION_NEEDED', 'ORDER_CONFIRMATION',
    'ORDER_DELAY', 'ORDER_OR_TRANSACTION_CANCEL', 'ORDER_PICK_UP',
    'PAYMENT_ACTION_REQUIRED', 'PAYMENT_CONFIRMATION', 'PAYMENT_DUE_REMINDER',
    'PAYMENT_OVERDUE', 'PAYMENT_REJECT_FAIL', 'PAYMENT_SCHEDULED',
    'RECEIPT_ATTACHMENT', 'RETURN_CONFIRMATION', 'SHIPMENT_CONFIRMATION',
    'STATEMENT_ATTACHMENT', 'STATEMENT_AVAILABLE', 'TRANSACTION_ALERT'
  ],
  languages: ['en_US']
}

module.exports = {
  filterTemplates,
  AVAILABLE_FILTERS,
  SAMPLE_TEMPLATES
}