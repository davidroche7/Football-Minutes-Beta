export interface StoredUser {
  username: string;
  saltHex: string;
  hashHex: string;
  iterations: number;
}

export const AUTH_USERS: StoredUser[] = [
  {
    username: 'coach',
    saltHex: '167542a1dc0ea194c2381b127b058c8a',
    hashHex: 'beb4c4ec95a2ceef11a806ec32de7408cbf35508e0b6ce2b2b00ddeb9d44b257',
    iterations: 210000,
  },
  {
    username: 'manager',
    saltHex: '9e24889bec8a963ddd0bf43e00514463',
    hashHex: 'a23a2450773c9bca58f1b32be28a7c53dffd61da3667d48e49a6ea66550ce2e3',
    iterations: 210000,
  },
];

export const SESSION_STORAGE_KEY = 'ffm:session';
