export type StoreProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  pricePaise: number;
  badge: string;
  accent: 'violet' | 'mint' | 'amber';
  published: boolean;
};

export const storeProducts: StoreProduct[] = [
  {
    id: 'workflow-starter',
    name: 'AI Workflow Starter',
    category: 'Automation',
    description: 'A practical starter kit for mapping repetitive work into reliable AI-assisted workflows.',
    pricePaise: 149900,
    badge: 'Starter kit',
    accent: 'violet',
    published: true,
  },
  {
    id: 'operator-playbook',
    name: 'Automation Operator Playbook',
    category: 'Guides',
    description: 'A structured operating guide for scoping, documenting, and improving business automations.',
    pricePaise: 99900,
    badge: 'Field guide',
    accent: 'mint',
    published: true,
  },
  {
    id: 'prompt-library',
    name: 'Business Prompt Library',
    category: 'Digital tools',
    description: 'Reusable prompt patterns for customer support, sales operations, research, and admin work.',
    pricePaise: 69900,
    badge: 'Digital resource',
    accent: 'amber',
    published: true,
  },
];

export const formatINR = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
