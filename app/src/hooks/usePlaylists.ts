import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PlaylistTrack {
    uri: string;
    filename: string;
}

export interface Playlist {
    id: string;
    name: string;
    tracks: PlaylistTrack[];
}

const PLAYLISTS_STORAGE_KEY = '@judebox_playlists';

export const usePlaylists = () => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);

    // Load playlists from storage on mount
    useEffect(() => {
        const loadPlaylists = async () => {
            try {
                const storedPlaylists = await AsyncStorage.getItem(PLAYLISTS_STORAGE_KEY);
                if (storedPlaylists) {
                    setPlaylists(JSON.parse(storedPlaylists));
                }
            } catch (error) {
                console.error('Failed to load playlists from AsyncStorage', error);
            } finally {
                setLoading(false);
            }
        };
        loadPlaylists();
    }, []);

    // Internal helper to save and update state
    const savePlaylists = async (newPlaylists: Playlist[]) => {
        try {
            await AsyncStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(newPlaylists));
            setPlaylists(newPlaylists);
        } catch (error) {
            console.error('Failed to save playlists to AsyncStorage', error);
        }
    };

    const createPlaylist = async (name: string): Promise<Playlist> => {
        const newPlaylist: Playlist = {
            id: Date.now().toString(),
            name,
            tracks: [],
        };
        await savePlaylists([...playlists, newPlaylist]);
        return newPlaylist;
    };

    const addTrackToPlaylist = async (playlistId: string, track: PlaylistTrack) => {
        const updatedPlaylists = playlists.map((p) => {
            if (p.id === playlistId) {
                // Prevent adding duplicate tracks to the same playlist
                if (p.tracks.some((t) => t.uri === track.uri || t.filename === track.filename)) {
                    return p;
                }
                return { ...p, tracks: [...p.tracks, track] };
            }
            return p;
        });
        await savePlaylists(updatedPlaylists);
    };

    const removeTrackFromPlaylist = async (playlistId: string, trackUri: string) => {
        const updatedPlaylists = playlists.map((p) => {
            if (p.id === playlistId) {
                return { ...p, tracks: p.tracks.filter((t) => t.uri !== trackUri) };
            }
            return p;
        });
        await savePlaylists(updatedPlaylists);
    };

    const deletePlaylist = async (playlistId: string) => {
        const updatedPlaylists = playlists.filter((p) => p.id !== playlistId);
        await savePlaylists(updatedPlaylists);
    };

    return {
        playlists,
        loading,
        createPlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        deletePlaylist,
    };
};
