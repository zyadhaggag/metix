import { create } from 'zustand'

interface LiveKitState {
    showChat: boolean
    showParticipants: boolean
    unreadChatCount: number

    toggleChat: () => void
    toggleParticipants: () => void
    setUnreadChatCount: (count: number) => void
    incrementUnreadChat: () => void
    resetSession: () => void
}

export const useLiveKitStore = create<LiveKitState>((set) => ({
    showChat: false,
    showParticipants: false,
    unreadChatCount: 0,

    toggleChat: () => set((state) => {
        const showing = !state.showChat
        return {
            showChat: showing,
            showParticipants: showing ? false : state.showParticipants,
            unreadChatCount: showing ? 0 : state.unreadChatCount
        }
    }),

    toggleParticipants: () => set((state) => {
        const showing = !state.showParticipants
        return {
            showParticipants: showing,
            showChat: showing ? false : state.showChat
        }
    }),

    setUnreadChatCount: (count) => set({ unreadChatCount: count }),

    incrementUnreadChat: () => set((state) => ({
        unreadChatCount: state.showChat ? 0 : state.unreadChatCount + 1
    })),

    resetSession: () => set({
        showChat: false,
        showParticipants: false,
        unreadChatCount: 0,
    })
}))
