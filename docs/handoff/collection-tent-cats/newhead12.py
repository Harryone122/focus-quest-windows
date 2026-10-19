"""v12 head: the head SHAPE follows the user's realistic reference cat (Fripouille), scaled to the old head size.
Coat, fur and painted details still come from the v11 head (newhead11) through a landmark mapping (old_coords).
Frame ('mine'): x forward, y = cat's left, z up, metres. Same their/cat mapping constants (O, K) as before."""
import numpy as np
from scipy import ndimage as ndi
from scipy.interpolate import RBFInterpolator
import newhead11 as OH

f32 = np.float32
D = np.deg2rad
K = OH.K
O = OH.O
T, Tinv, to_their, to_mine = OH.T, OH.Tinv, OH.to_their, OH.to_mine
smin, smax, ell = OH.smin, OH.smax, OH.ell
S = 0.85                                   # reference head scaled to the old head's overall size

_R = np.load(__file__.replace('newhead12.py', 'ref_head_sdf.npz'))
_G, _xa, _ya, _za = _R['G'], _R['x'], _R['y'], _R['z']
_STEP = float(_xa[1] - _xa[0])


def _ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _ref(q):
    """reference signed distance at unscaled reference coordinates q (metres)."""
    idx = [(q[..., 0] - _xa[0]) / _STEP, (q[..., 1] - _ya[0]) / _STEP, (q[..., 2] - _za[0]) / _STEP]
    flat = [i.ravel() for i in idx]
    v = ndi.map_coordinates(_G, flat, order=1, mode='nearest').reshape(q.shape[:-1])
    out = (idx[0] < 0) | (idx[0] > len(_xa) - 1) | (idx[1] < 0) | (idx[1] > len(_ya) - 1) | (idx[2] < 0) | (idx[2] > len(_za) - 1)
    return np.where(out, np.maximum(v, 0.01), v)


# ---------------- eyes (measured on the reference eyeballs, scaled) ----------------
EYE_X = -0.0097 * S
EYE_Y = 0.0235 * S
EYE_R = 0.0161 * S
EYE_YAW = D(4)
EYE_OBL = D(4)


EYE_PITCH = D(10)          # the reference lid opening sits ~2.5 mm below the eyeball centre: look slightly down into it


def eye_axes(s):
    c = np.array([EYE_X, s * EYE_Y, 0.0])
    cp, sp = np.cos(EYE_PITCH), np.sin(EYE_PITCH)
    f = np.array([np.cos(EYE_YAW) * cp, s * np.sin(EYE_YAW) * cp, -sp])
    o = np.array([-np.sin(EYE_YAW), s * np.cos(EYE_YAW), 0.0])
    u = np.cross(f, o) * s
    u = u / np.linalg.norm(u)
    if u[2] < 0: u = -u
    o2 = o * np.cos(EYE_OBL) + u * np.sin(EYE_OBL)
    u2 = -o * np.sin(EYE_OBL) + u * np.cos(EYE_OBL)
    return c, f, o2, u2


# ---------------- mouth (measured on the reference mouth slit, scaled) ----------------
HINGE = np.array([-0.0204, -0.0400])
GAPE_HALF, GAPE_XC = 0.0120, 0.0040


def crease_line(y):
    return 0.02193 - 58.8 * y * y, -0.0397 - 15.3 * y * y


def mouth_crease(p):
    x, z = crease_line(p[..., 1])
    d = np.sqrt((p[..., 0] - x) ** 2 + (p[..., 2] - z) ** 2)
    fade = np.clip(1.0 - np.abs(p[..., 1]) / 0.016, 0, 1)
    return 0.0004 * fade - d          # v12: only a hairline; the reference lips give the crease


def mouth_z(x, y):
    xc, zc = crease_line(y)
    return zc + 0.03 * np.clip(xc - x, 0, None)


def gape_in(x, y):
    a = x - GAPE_XC
    b = GAPE_HALF - np.abs(y)
    k = 0.004
    hk = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - hk) + a * hk - k * hk * (1 - hk)


LIP_FRONT = crease_line(0.0)[0]
MOUTH_C = np.array([LIP_FRONT - 0.0145, 0.0, crease_line(0.0)[1]])     # centre of the mouth cavity (rest pose); its front stays 3 mm behind the lips
NOSE_MINE = np.array([0.0348 * S - 0.0035, 0.0, -0.0240 * S])          # middle of the nose tip
PAD_MINE = np.array([LIP_FRONT - 0.0035, 0.0078, crease_line(0.0)[1] + 0.0070])
EAR_BASE_MINE = np.array([-0.0400 * S, 0.0400 * S, 0.0360 * S])        # where the reference ears leave the skull

TEETH = []
_zc = crease_line(0.0)[1]
for s_ in (1, -1):
    TEETH.append(((LIP_FRONT - 0.0040, s_ * 0.0080, _zc + 0.0018), (LIP_FRONT - 0.0034, s_ * 0.0076, _zc - 0.0024), 0.0012, 0))   # upper canines: tips hidden behind the lower lip at rest
    TEETH.append(((LIP_FRONT - 0.0052, s_ * 0.0066, _zc - 0.0020), (LIP_FRONT - 0.0049, s_ * 0.0070, _zc + 0.0016), 0.0010, 1))


def parts(p):
    """head SDF (mine frame). Only 'head' is geometry; region weights come from the old head via old_coords()."""
    q = p / S
    h = _ref(q)
    # ears: cut the reference ears off the skull (ours go on at EAR_BASE_MINE) — only behind the eyes
    cap = ell(q, (-0.028, 0.0, -0.012), (0.060, 0.057, 0.055)) - 0.06 * _ss(-0.024, -0.014, q[..., 0])
    h = smax(h, cap, 0.004)
    # keep the head and let the old neck carry on below / behind it
    reg = ell(q, (-0.010, 0.0, -0.010), (0.062, 0.070, 0.058))
    h = smax(h, reg, 0.006) * S
    for s in (1, -1):                                                 # v14: cheek flesh beside the whisker pads
        h = smin(h, ell(p, (0.008, s * 0.019, -0.031), (0.011, 0.009, 0.010)), 0.006)
    h = smax(h, mouth_crease(p), 0.0008)
    for s in (1, -1):
        c, f, o, u = eye_axes(s)
        h = smax(h, -(np.linalg.norm(p - c, axis=-1) - (EYE_R + 0.0003)), 0.0)
    return {'head': h}


def parts_their(mz):
    d = parts(to_mine(mz))
    return {k: v * K for k, v in d.items()}


def their_eye(s_their):
    c, f, o, u = eye_axes(-s_their)
    return to_their(c), T(f), T(u), T(o)


# ---------------- lid opening, measured where the reference skin leaves the eyeball ----------------
def _measure_aperture():
    c, f, o, u = eye_axes(1)
    th = np.linspace(0, np.pi * 0.62, 70); ph = np.linspace(0, 2 * np.pi, 240)
    TH, PH = np.meshgrid(th, ph, indexing='ij')
    dirs = (np.cos(TH)[..., None] * f + np.sin(TH)[..., None] * (np.cos(PH)[..., None] * o + np.sin(PH)[..., None] * u))
    P = c + dirs * (EYE_R + 0.0010)
    vis = _ref(P / S) * S > 0.0004
    q = P[vis] - c
    b, cc = q @ o, q @ u
    return float(np.abs(b).max()), float(cc.max()), float(-cc.min()), float(0.5 * (cc.max() + cc.min()))


AP_W, AP_UP, AP_LO, _AP_MID = _measure_aperture()
LID_T = 0.0008


def lid_line(b):
    t = np.clip(b / AP_W, -1.0, 1.0)
    return _AP_MID - 0.0012 * np.clip(-t, 0, 1) ** 2 + 0.0006 * np.clip(t, 0, 1) ** 2


def lid_half(b):
    t2 = np.clip((b / AP_W) ** 2, 0.0, 1.0)
    return (AP_UP - _AP_MID) * (1.0 - t2) ** 0.55, (AP_LO + _AP_MID) * (1.0 - t2) ** 0.80


# ---------------- new head -> old (v11, unwarped) head coordinates for coat / fur / painted details ----------------
_NEW = []; _OLD = []
def _pair(n, o, mirror=False):
    _NEW.append(n); _OLD.append(o)
    if mirror:
        _NEW.append([n[0], -n[1], n[2]]); _OLD.append([o[0], -o[1], o[2]])
_pair([EYE_X, EYE_Y, 0.0], [OH.EYE_X, OH.EYE_Y, 0.0], True)
_pair([0.0348 * S, 0.0, -0.0240 * S], [0.0313, 0.0, -0.0116])                 # nose tip
_pair([0.018 * S, 0.0, 0.0], [0.0160, 0.0, 0.0])                              # bridge between the eyes
_pair([-0.030 * S, 0.0, 0.044 * S], [-0.028, 0.0, 0.039])                     # top of the head
_pair([-0.065 * S, 0.0, 0.020 * S], [-0.062, 0.0, 0.015])                     # back of the head
_pair([LIP_FRONT, 0.0, crease_line(0.0)[1]], [0.0240, 0.0, -0.0315])          # mouth at the front
_pair([0.010 * S, 0.0, -0.058 * S], [0.0130, 0.0, -0.0410])                   # chin
_pair([PAD_MINE[0], PAD_MINE[1], PAD_MINE[2]], [0.0192, 0.0088, -0.0222], True)   # whisker pads
_pair([-0.025 * S, 0.057 * S, -0.013 * S], [-0.012, 0.050, -0.011], True)     # widest cheek
_pair(list(EAR_BASE_MINE), [-0.016, 0.037, 0.029], True)                       # ear bases
_pair([-0.020 * S, 0.0, -0.065 * S], [-0.015, 0.0, -0.042])                   # throat under the jaw
_pair([crease_line(0.014)[0], 0.014, crease_line(0.014)[1]], [0.0030, 0.014, -0.0300], True)   # mouth corners
# far away the mapping is the identity (body, neck)
for th in np.linspace(0, np.pi, 6):
    for ph in np.linspace(0, 2 * np.pi, 10, endpoint=False):
        v = np.array([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)]) * 0.12 + np.array([-0.01, 0, -0.01])
        _pair(list(v), list(v))
_NEW = np.array(_NEW); _OLD = np.array(_OLD)
_TPS = RBFInterpolator(_NEW, _OLD - _NEW, kernel='thin_plate_spline', smoothing=1e-7)


def old_coords(m):
    """map new-head points (mine) to where the same feature sits on the old v11 head (mine, unwarped)."""
    m = np.asarray(m, float)
    sh = m.shape
    flat = m.reshape(-1, 3)
    w = 1.0 - _ss(0.075, 0.11, np.linalg.norm(flat - np.array([-0.01, 0, -0.01]), axis=1))
    return (flat + _TPS(flat) * w[:, None]).reshape(sh)


# ---------------- v13: muzzle and chin further forward (user's profile sketch) ----------------
# Applied to the finished mesh like the v11 warp: everything (cut, coat, lids) is built on the unmoved head first.
def _snout_w(m):
    x, y, z = m[..., 0], m[..., 1], m[..., 2]
    wz = _ss(-0.018, -0.030, z) * (1.0 - _ss(-0.060, -0.072, z))    # from below the nose down to the chin, not the throat
    wx = _ss(-0.006, 0.010, x)
    wy = np.exp(-(y / 0.014) ** 2)                                   # v14: bell-shaped across the face -> a round muzzle, not a box
    wyc = np.exp(-(y / 0.010) ** 2)
    chin = _ss(-0.036, -0.046, z) * (1.0 - _ss(-0.058, -0.068, z))   # the chin comes out a little more than the lips
    return wz * wx * wy, chin * wx * wyc


def snout_disp(m):
    w, c = _snout_w(m)
    return w[..., None] * np.array([0.0070, 0.0, -0.0012]) + c[..., None] * np.array([0.0030, 0.0, -0.0010])


def warp(m):
    return m + snout_disp(m)
