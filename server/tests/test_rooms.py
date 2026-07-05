from app.config import Settings
from app.rooms import Peer, RoomRegistry, relay


def _reg() -> RoomRegistry:
    return RoomRegistry(Settings(mode="fallback", fallback_sleep=False))


def test_two_peers_share_a_room_and_see_each_other():
    reg = _reg()
    reg.join("r1", Peer(id="a", lang="zul", ws=object()))
    room = reg.join("r1", Peer(id="b", lang="eng", ws=object()))
    assert len(room.peers) == 2
    assert room.other("a").id == "b"
    assert room.other("b").lang == "zul"


def test_solo_peer_has_no_other():
    reg = _reg()
    room = reg.join("r1", Peer(id="a", lang="zul", ws=object()))
    assert room.other("a") is None


def test_leaving_removes_peer_and_empty_room_is_dropped():
    reg = _reg()
    reg.join("r1", Peer(id="a", lang="zul", ws=object()))
    reg.join("r1", Peer(id="b", lang="eng", ws=object()))
    still = reg.leave("r1", "a")
    assert still is not None and "a" not in still.peers
    gone = reg.leave("r1", "b")
    assert gone is None
    assert reg.get("r1") is None


def test_relay_translates_into_the_listeners_language():
    reg = _reg()
    reg.join("r1", Peer(id="a", lang="zul", ws=object()))
    room = reg.join("r1", Peer(id="b", lang="eng", ws=object()))
    listener, turn, sent = relay(room, "a", bytes(2 * 16000))
    assert listener.id == "b"
    assert turn.src_lang == "zul" and turn.dst_lang == "eng"
    assert turn.audio_b64  # listener gets audio
    assert sent.src_text and sent.dst_text  # speaker gets a text echo


def test_relay_returns_none_when_alone():
    reg = _reg()
    room = reg.join("r1", Peer(id="a", lang="zul", ws=object()))
    assert relay(room, "a", bytes(10)) == (None, None, None)
