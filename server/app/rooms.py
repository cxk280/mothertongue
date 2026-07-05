"""In-memory registry of two-way call rooms.

Kept I/O-free (it never touches a WebSocket) so it is unit-testable: peers hold an
opaque `ws` handle that only the /room endpoint in main.py sends on. Each room owns
one pipeline; a room is discarded when its last peer leaves.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .config import Settings
from .messages import ServerSent, ServerTurn
from .pipeline import Pipeline, build_pipeline


@dataclass
class Peer:
    id: str
    lang: str
    ws: object  # WebSocket-like; opaque here to keep this module I/O-free


@dataclass
class Room:
    id: str
    pipeline: Pipeline
    peers: dict[str, Peer] = field(default_factory=dict)

    def other(self, peer_id: str) -> Peer | None:
        """This is a 1:1 call — the single peer that is not `peer_id` (or None)."""
        for pid, p in self.peers.items():
            if pid != peer_id:
                return p
        return None


class RoomRegistry:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._rooms: dict[str, Room] = {}

    def get(self, room_id: str) -> Room | None:
        return self._rooms.get(room_id)

    def join(self, room_id: str, peer: Peer) -> Room:
        room = self._rooms.get(room_id)
        if room is None:
            room = Room(id=room_id, pipeline=build_pipeline(self._settings))
            self._rooms[room_id] = room
        room.peers[peer.id] = peer
        return room

    def leave(self, room_id: str, peer_id: str) -> Room | None:
        """Remove a peer; drop the room when empty. Returns the room if it still exists."""
        room = self._rooms.get(room_id)
        if room is None:
            return None
        room.peers.pop(peer_id, None)
        if not room.peers:
            self._rooms.pop(room_id, None)
            return None
        return room


def relay(
    room: Room, speaker_id: str, pcm: bytes
) -> tuple[Peer | None, ServerTurn | None, ServerSent | None]:
    """Run the speaker's utterance through the pipeline into the listener's language.

    Pure (no I/O) and synchronous so the /room endpoint can run it in a threadpool
    and unit tests can call it directly. Returns (listener, turn, sent), all None if
    there is no other peer to translate for.
    """
    speaker = room.peers.get(speaker_id)
    listener = room.other(speaker_id)
    if speaker is None or listener is None:
        return None, None, None
    turn = room.pipeline.run(pcm, speaker.lang, listener.lang)
    sent = ServerSent(
        id=turn.id,
        src_text=turn.src_text,
        dst_text=turn.dst_text,
        timings=turn.timings,
    )
    return listener, turn, sent
