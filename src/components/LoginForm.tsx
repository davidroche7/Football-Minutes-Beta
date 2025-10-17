import { useState } from 'react';
import type { AuthSession } from '../lib/auth';
import { verifyCredentials } from '../lib/auth';

interface LoginFormProps {
  onSuccess: (session: AuthSession) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const session = await verifyCredentials(username.trim(), password);
      if (!session) {
        setError('Invalid username or password.');
        return;
      }
      onSuccess(session);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-center text-2xl font-semibold text-gray-900 dark:text-white">
        Sign In
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="login-username"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Username
          </label>
          <input
            id="login-username"
            type="text"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
        >
          {isSubmitting ? 'Signing In…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
