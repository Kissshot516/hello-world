import { queryArtistsTool } from './queryArtists.js';
import { queryConcertsTool } from './queryConcerts.js';
import { queryPlaylistsTool } from './queryPlaylists.js';
import { querySongsTool } from './querySongs.js';

export const tools = [querySongsTool, queryArtistsTool, queryPlaylistsTool, queryConcertsTool];
