import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Image } from 'react-native';
import { Music, Plus, Trash2, ChevronLeft, PlayCircle, Play } from 'lucide-react-native';
import { Playlist, PlaylistTrack } from '../hooks/usePlaylists';

interface PlaylistsViewProps {
    playlists: Playlist[];
    onCreatePlaylist: (name: string) => void;
    onDeletePlaylist: (id: string) => void;
    onRemoveTrack: (playlistId: string, trackUri: string) => void;
    onPlayTrack: (track: PlaylistTrack, playlistId: string) => void;
    onPlayPlaylist: (playlistId: string) => void;
}

const COLORS = {
    bg: '#0F172A',         // Slate 900
    card: '#1E293B',       // Slate 800
    accent: '#8B5CF6',     // Violet 500
    text: '#F8FAFC',       // Slate 50
    textMuted: '#94A3B8',  // Slate 400
    danger: '#EF4444',     // Red 500
    dangerGhost: 'rgba(239, 68, 68, 0.15)',
};

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
    playlists,
    onCreatePlaylist,
    onDeletePlaylist,
    onRemoveTrack,
    onPlayTrack,
    onPlayPlaylist
}) => {
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);

    const handleCreate = () => {
        if (newPlaylistName.trim().length === 0) return;
        onCreatePlaylist(newPlaylistName.trim());
        setNewPlaylistName('');
        setIsCreating(false);
    };

    const confirmDeletePlaylist = (id: string, name: string) => {
        Alert.alert(
            "Supprimer la playlist",
            `Es-tu sûr de vouloir supprimer "${name}" ?`,
            [
                { text: "Annuler", style: "cancel" },
                { text: "Supprimer", style: "destructive", onPress: () => onDeletePlaylist(id) }
            ]
        );
    };

    if (activePlaylist) {
        // Re-find active playlist to ensure tracks are up-to-date if modified
        const currentPlaylist = playlists.find(p => p.id === activePlaylist.id);

        if (!currentPlaylist) {
            setActivePlaylist(null);
            return null;
        }

        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setActivePlaylist(null)} style={styles.backBtn}>
                        <ChevronLeft size={24} color={COLORS.text} />
                        <Text style={styles.backText}>Retour</Text>
                    </TouchableOpacity>
                    <Text style={styles.title} numberOfLines={1}>{currentPlaylist.name}</Text>
                    {currentPlaylist.tracks.length > 0 && (
                        <TouchableOpacity
                            style={styles.headerPlayBtn}
                            onPress={() => onPlayPlaylist(currentPlaylist.id)}
                        >
                            <Play size={20} color={COLORS.bg} fill={COLORS.bg} style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                    )}
                </View>

                {currentPlaylist.tracks.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Music size={48} color={COLORS.textMuted} style={{ marginBottom: 16 }} />
                        <Text style={styles.emptyText}>Cette playlist est vide.</Text>
                        <Text style={styles.emptySubText}>Ajoute des musiques depuis l'onglet Bibliothèque.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={currentPlaylist.tracks}
                        keyExtractor={item => item.uri}
                        renderItem={({ item }) => (
                            <View style={styles.trackCard}>
                                <TouchableOpacity
                                    style={styles.trackInfo}
                                    onPress={() => onPlayTrack(item, currentPlaylist.id)}
                                >
                                    <View style={styles.trackIcon}>
                                        <PlayCircle size={24} color={COLORS.accent} />
                                    </View>
                                    <Text style={styles.trackName} numberOfLines={2}>{item.filename}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => onRemoveTrack(currentPlaylist.id, item.uri)}
                                    style={styles.deleteBtn}
                                >
                                    <Trash2 size={20} color={COLORS.danger} />
                                </TouchableOpacity>
                            </View>
                        )}
                        contentContainerStyle={styles.listContent}
                    />
                )}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {isCreating ? (
                <View style={styles.createContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Nom de la playlist..."
                        placeholderTextColor={COLORS.textMuted}
                        value={newPlaylistName}
                        onChangeText={setNewPlaylistName}
                        autoFocus
                    />
                    <View style={styles.createActions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreating(false)}>
                            <Text style={styles.cancelText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}>
                            <Text style={styles.saveText}>Créer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <TouchableOpacity style={styles.newPlaylistBtn} onPress={() => setIsCreating(true)}>
                    <Plus size={20} color={COLORS.text} />
                    <Text style={styles.newPlaylistText}>Nouvelle Playlist</Text>
                </TouchableOpacity>
            )}

            {playlists.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Aucune playlist.</Text>
                </View>
            ) : (
                <FlatList
                    data={playlists}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.playlistCard} onPress={() => setActivePlaylist(item)}>
                            <View style={styles.playlistIcon}>
                                <Music size={24} color={COLORS.accent} />
                            </View>
                            <View style={styles.playlistInfo}>
                                <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.playlistCount}>{item.tracks.length} piste(s)</Text>
                            </View>

                            {item.tracks.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => onPlayPlaylist(item.id)}
                                    style={styles.playQuickBtn}
                                >
                                    <Play size={20} color={COLORS.accent} fill={COLORS.accent} style={{ marginLeft: 2 }} />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={() => confirmDeletePlaylist(item.id, item.name)}
                                style={styles.deleteBtn}
                            >
                                <Trash2 size={20} color={COLORS.danger} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.card,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    backText: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '500',
    },
    title: {
        flex: 1,
        color: COLORS.accent,
        fontSize: 18,
        fontWeight: '700',
    },
    headerPlayBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    emptyText: {
        color: COLORS.textMuted,
        fontSize: 16,
        fontWeight: '500',
    },
    emptySubText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    createContainer: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    input: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        color: COLORS.text,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 12,
    },
    createActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    cancelBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    cancelText: {
        color: COLORS.textMuted,
        fontWeight: '600',
    },
    saveBtn: {
        backgroundColor: COLORS.accent,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    saveText: {
        color: '#fff',
        fontWeight: '600',
    },
    newPlaylistBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        gap: 12,
    },
    newPlaylistText: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: 40,
    },
    playlistCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.02)',
    },
    playlistIcon: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    playlistInfo: {
        flex: 1,
    },
    playlistName: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    playlistCount: {
        color: COLORS.textMuted,
        fontSize: 14,
    },
    trackCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.02)',
    },
    trackInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    trackIcon: {
        marginRight: 12,
    },
    trackName: {
        color: COLORS.text,
        fontSize: 14,
        flex: 1,
    },
    deleteBtn: {
        padding: 8,
        marginLeft: 4,
    },
    playQuickBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
});
