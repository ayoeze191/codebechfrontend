import { writable } from 'svelte/store';

type CandidateState = {
	codeByQuestion: Record<string, string>;
};

function createCandidateStore() {
	const { subscribe, update } = writable<CandidateState>({
		codeByQuestion: {}
	});

	return {
		subscribe,
		updateCode(questionId: string, code: string) {
			if (!questionId) return;

			update((state) => ({
				...state,
				codeByQuestion: {
					...state.codeByQuestion,
					[questionId]: code
				}
			}));
		}
	};
}

export const candidateStore = createCandidateStore();
