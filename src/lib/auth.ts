import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { api } from './api';

export type User = {
	id: string;
	email: string;
	name?: string | null;
	role: 'ADMIN' | 'RECRUITER' | 'CANDIDATE' | string;
};

type AuthState = {
	user: User | null;
	token: string | null;
	ready: boolean;
};

const initialState: AuthState = {
	user: null,
	token: null,
	ready: false
};

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);

	function persist(user: User | null, token: string | null) {
		if (!browser) return;

		if (user && token) {
			localStorage.setItem('codebench_user', JSON.stringify(user));
			localStorage.setItem('codebench_token', token);
		} else {
			localStorage.removeItem('codebench_user');
			localStorage.removeItem('codebench_token');
		}
	}
	function purge(){
		localStorage.removeItem('codebench_user');
		localStorage.removeItem('codebench_token');
	}

	return {
		subscribe,
		init() {
			if (!browser) return;

			const token = localStorage.getItem('codebench_token');
			const rawUser = localStorage.getItem('codebench_user');
			const user = rawUser ? (JSON.parse(rawUser) as User) : null;
			set({ user, token, ready: true });
		},
		async login(email: string, password: string) {
			const response = await api.post<{ user: User; token: string }>(
				'/auth/login',
				{ email, password },
				{ auth: false }
			);
			persist(response.user, response.token);
			set({ user: response.user, token: response.token, ready: true });
			return response.user;
		},
		async register(payload: { email: string; password: string; name?: string; role?: string }) {
			const response = await api.post<{ user: User; token: string }>('/auth/register', payload, {
				auth: false
			});
			persist(response.user, response.token);
			set({ user: response.user, token: response.token, ready: true });
			return response.user;
		},
		logout() {
			
			persist(null, null);
			set({ user: null, token: null, ready: true });
		},
		setReady() {
			update((state) => ({ ...state, ready: true }));
		}
	};
}

export const auth = createAuthStore();
