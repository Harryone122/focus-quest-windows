"""v11 head (from v10/v9/v8) for the cat, designed in 'mine' head frame (x fwd, y = cat's left, z up, origin = midpoint
between the eye centres, metres) from the user's 3-view reference, then mapped into gen_cat's unscaled head
space (x fwd, y up, z = cat's RIGHT, origin = H) by  mz = O + K * T(p),  T(x, y, z) = (x, z, -y)."""
import numpy as np

f32 = np.float32
D = np.deg2rad
K = 1.18
O = np.array([0.032, 0.006, 0.0])


def T(p):
    p = np.asarray(p, float)
    return np.stack([p[..., 0], p[..., 2], -p[..., 1]], -1)


def Tinv(q):
    q = np.asarray(q, float)
    return np.stack([q[..., 0], -q[..., 2], q[..., 1]], -1)


def to_their(p):
    return O + K * T(p)


def to_mine(mz):
    return Tinv((np.asarray(mz, float) - O) / K)


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def smax(a, b, k):
    return -smin(-a, -b, k)


def rot_z(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def rot_y(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def ell(p, c, r, R=None):
    q = p - np.asarray(c, float)
    if R is not None:
        q = q @ R
    r = np.asarray(r, float)
    k0 = np.linalg.norm(q / r, axis=-1)
    k1 = np.linalg.norm(q / (r * r), axis=-1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-12)


NOSE_MINE = np.array([0.0268, 0.0, -0.0126])
PAD_MINE = np.array([0.0192, 0.0088, -0.0222])

# ---------------- eyes (mine frame)
EYE_R = 0.0130
EYE_Y = 0.0228
EYE_X = 0.0005
EYE_YAW = D(17)
EYE_OBL = D(4)
AP_W = 0.0120            # half width of the lid opening along the eye's horizontal axis
AP_UP, AP_LO = 0.0080, 0.0062   # v10: almond opening (v9 was a near-circle 11.8 mm high): upper arc taller, lower flatter
LID_T = 0.0010           # lid thickness over the globe
ORB_A0 = 0.0080          # dish: skin limit along the gaze at radius ORB_R0 ...
ORB_R0 = 0.0110
ORB_S = 0.62             # ... rising outward at this slope
ORB_FADE = 0.08          # the dish fades out away from the eye so the nose and cheeks keep their volume


def lid_line(b):
    """centre line of the almond opening (along u) at position b along the outer axis: inner corner (b<0) lower."""
    t = np.clip(b / AP_W, -1.0, 1.0)
    return -0.0016 * np.clip(-t, 0, 1) ** 2 + 0.0008 * np.clip(t, 0, 1) ** 2


def lid_half(b):
    """upper and lower half-heights of the opening at b (pointed corners)."""
    t2 = np.clip((b / AP_W) ** 2, 0.0, 1.0)
    return AP_UP * (1.0 - t2) ** 0.55, AP_LO * (1.0 - t2) ** 0.80


def eye_axes(s):
    """s = +1 cat's left, -1 cat's right (mine frame)."""
    c = np.array([EYE_X, s * EYE_Y, 0.0])
    f = np.array([np.cos(EYE_YAW), s * np.sin(EYE_YAW), 0.0])
    o = np.array([-np.sin(EYE_YAW), s * np.cos(EYE_YAW), 0.0])
    u = np.array([0.0, 0.0, 1.0])
    o2 = o * np.cos(EYE_OBL) + u * np.sin(EYE_OBL)
    u2 = -o * np.sin(EYE_OBL) + u * np.cos(EYE_OBL)
    return c, f, o2, u2


def orbit_dish(p, h):
    # v9/v10: the skull, brow and cheeks may not come forward of max(lid shell over the globe, a cone rising from it),
    # so the eye sits in a shallow mound instead of the deep tube of v8.
    for s in (1, -1):
        c, f, o, u = eye_axes(s)
        q = p - c
        a = q @ f
        rho = np.sqrt(np.maximum((q * q).sum(-1) - a * a, 0.0))
        shell = np.sqrt(np.maximum((EYE_R + LID_T + 0.0004) ** 2 - rho * rho, 0.0))
        cone = ORB_A0 + ORB_S * (rho - ORB_R0)
        amax = -smin(-shell, -cone, 0.002) + ORB_FADE * np.clip((rho - 0.025) / 0.008, 0, 1) ** 2
        cut = (a - amax) / np.sqrt(1 + ORB_S * ORB_S)
        h = smax(h, cut, 0.003)
    return h


def parts(p):
    """component SDFs of the head (mine frame, metres)."""
    d = {}
    cran = ell(p, (-0.024, 0, 0.004), (0.043, 0.046, 0.031))
    cran = smin(cran, ell(p, (-0.034, 0, 0.012), (0.026, 0.034, 0.024)), 0.015)
    cran = smin(cran, ell(p, (-0.007, 0, 0.012), (0.017, 0.030, 0.019)), 0.012)   # v9: forehead set back so the brow no longer hoods the eyes
    # muzzle as a dome: nose tip is the front-most point, everything curves back from it
    bridge = ell(p, (0.0165, 0, -0.0050), (0.0125, 0.0082, 0.0070), rot_y(D(48)))   # v9: narrow ridge rising from the nose to the stop
    cheeks = np.minimum(ell(p, (-0.012, 0.032, -0.011), (0.026, 0.021, 0.021)),
                        ell(p, (-0.012, -0.032, -0.011), (0.026, 0.021, 0.021)))
    jaw = ell(p, (-0.008, 0, -0.021), (0.032, 0.036, 0.016))
    side = np.minimum(ell(p, (0.003, 0.016, -0.011), (0.0095, 0.0095, 0.0085)),
                      ell(p, (0.003, -0.016, -0.011), (0.0095, 0.0095, 0.0085)))
    mbase = ell(p, (0.0080, 0, -0.0215), (0.0165, 0.0190, 0.0100))   # v11: stops at the mouth line
    # whisker pads: tall, reaching up to mid-nose height so the nose sits in the top of the muzzle puff
    # v10: pads further forward and rounder, so the muzzle reads as a clear puff in profile (just behind the nose tip)
    pads = np.minimum(ell(p, PAD_MINE * np.array([1, 1, 1]), (0.0106, 0.0106, 0.0112), rot_z(D(22))),
                      ell(p, PAD_MINE * np.array([1, -1, 1]), (0.0106, 0.0106, 0.0112), rot_z(D(-22))))
    pads = smin(pads, ell(p, (0.0205, 0.0, -0.0236), (0.0080, 0.0076, 0.0072)), 0.005)   # shallow philtrum groove
    nose = ell(p, NOSE_MINE, (0.0047, 0.0056, 0.0038), rot_y(D(-12)))
    # v11 (reference model): the whisker pads overhang a small lower lip set ~4 mm back, then a small round chin
    chin = ell(p, (0.0145, 0, -0.0336), (0.0080, 0.0102, 0.0048))                      # lower lip (front ~22.5 mm)
    chin = smin(chin, ell(p, (0.0130, 0, -0.0364), (0.0076, 0.0092, 0.0044)), 0.003)   # chin
    chin = smin(chin, ell(p, (0.0020, 0, -0.0350), (0.0155, 0.0160, 0.0060)), 0.005)   # fills the scoop under the jaw
    d['cran'] = smin(cran, bridge, 0.010)
    d['cheeks'] = smin(cheeks, jaw, 0.014)
    d['muzzle'] = smin(smin(mbase, side, 0.010), pads, 0.006)
    d['chin'] = chin
    d['nose'] = nose
    h = smin(d['cran'], d['cheeks'], 0.014)
    h = orbit_dish(p, h)          # v9: dish only the skull / brow / cheeks; the muzzle keeps its full volume
    h = smin(h, side, 0.010)
    h = smin(h, mbase, 0.010)
    h = smin(h, pads, 0.006)
    h = smin(h, nose, 0.004)
    h = smin(h, chin, 0.004)
    h = smax(h, mouth_crease(p), 0.0009)    # v11: the mouth is a soft crease under the pads
    for s in (1, -1):
        c, f, o, u = eye_axes(s)
        h = smin(h, np.linalg.norm(p - c, axis=-1) - (EYE_R + LID_T), 0.003)
    for s in (1, -1):
        c, f, o, u = eye_axes(s)
        q = p - c
        a = q @ f
        b = q @ o
        cc = q @ u
        up_, lo_ = lid_half(b)
        cl = lid_line(b)
        hh = np.where(cc > cl, up_, lo_)
        tb = np.abs(b) / AP_W
        e = np.maximum(np.abs(cc - cl) / np.maximum(hh, 1e-4), tb) - 1.0     # <0 inside the almond
        e = np.maximum(e, -1.0) * np.minimum(AP_W, np.maximum(hh, 0.0015))
        tun = np.maximum(e, -(a - 0.0015))
        h = smax(h, -tun, 0.0010)
        h = smax(h, -(np.linalg.norm(p - c, axis=-1) - (EYE_R + 0.0002)), 0.0)
    d['head'] = h
    return d


def parts_their(mz):
    """same components evaluated in gen_cat's unscaled head space (distances in those units)."""
    d = parts(to_mine(mz))
    return {k: v * K for k, v in d.items()}


# ---------------- features in their unscaled head space (for shaders / meta)
def their_eye(s_their):
    """s_their = +1 -> cat's right (their +z) = mine s=-1."""
    c, f, o, u = eye_axes(-s_their)
    return to_their(c), T(f), T(u), T(o)


EAR_BASE_MINE = np.array([-0.016, 0.037, 0.029])




# ---------------- v11 mouth (mine frame, metres) ----------------
# The rest pose is the closed head above (no seam). For a yawn the skin is cut along the crease inside GAPE (between the
# whisker pads), the lower part turns about the jaw joint, and a separate mouth (palate, floor, tongue, teeth) shows inside.
HINGE = np.array([-0.014, -0.028])          # (x, z) of the jaw joint, level with the mouth line, behind the corner
GAPE_HALF, GAPE_XC = 0.0145, 0.003          # opening only as wide as the whisker pads; corners rounded back to x = 3 mm


def crease_line(y):
    """front x and height z of the mouth crease at lateral position y (ω: pads hang lower, notch under the philtrum)."""
    ay = np.abs(y)
    x = 0.0240 - 9.0 * ay * ay
    z = -0.0315 - 0.0008 * np.exp(-((ay - 0.0080) / 0.0045) ** 2) + 0.0006 * np.exp(-(ay / 0.0022) ** 2)
    return x, z


def mouth_crease(p):
    """> 0 inside a thin round groove along the crease line (only across the front of the muzzle)."""
    x, z = crease_line(p[..., 1])
    d = np.sqrt((p[..., 0] - x) ** 2 + (p[..., 2] - z) ** 2)
    fade = np.clip(1.0 - np.abs(p[..., 1]) / 0.017, 0, 1)
    return (0.0008 * fade - d)


def mouth_z(x, y):
    """height of the cut surface: the crease height, rising slightly toward the back of the mouth."""
    xc, zc = crease_line(y)
    return zc + 0.04 * np.clip(xc - x, 0, None)


def gape_in(x, y):
    """> 0 inside the region where the lips part (metres)."""
    a = x - GAPE_XC
    b = GAPE_HALF - np.abs(y)
    k = 0.004
    hk = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - hk) + a * hk - k * hk * (1 - hk)


# teeth (rest pose, mine frame): (base, tip, radius, jaw) — jaw 0 = upper, 1 = lower
TEETH = []
for s_ in (1, -1):
    TEETH.append(((0.0216, s_ * 0.0088, -0.0300), (0.0222, s_ * 0.0085, -0.0345), 0.0013, 0))   # upper canines (tips just below the lip)
    TEETH.append(((0.0188, s_ * 0.0074, -0.0330), (0.0191, s_ * 0.0077, -0.0300), 0.0011, 1))   # lower canines


# ---------------- v11: longer muzzle (closer to the reference model's proportions) ----------------
# The whole muzzle / mouth / chin below the eyes is moved forward and down as one piece; eyes, lids, brow, ears,
# jaw joint and body do not move. The mesh, colours and fur are built on the unmoved head and then warped, so every
# painted detail (nose leather, philtrum, coat pattern) moves with it.
MUZZLE_SHIFT = np.array([0.0042, 0.0, -0.0108])


def _ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def face_disp(m):
    x, y, z = m[..., 0], m[..., 1], m[..., 2]
    hi = -0.008 + 0.007 * _ss(0.014, 0.022, x)          # in front of the eyes the stretch starts higher (nose bridge)
    wz = _ss(hi, hi - 0.008, z)
    wx = _ss(-0.012, 0.006, x)
    wy = 1.0 - _ss(0.022, 0.034, np.abs(y))
    wr = 1.0 - _ss(0.055, 0.070, np.linalg.norm(m - np.array([0.010, 0.0, -0.020]), axis=-1))
    wb = _ss(-0.075, -0.060, z)
    w = wz * wx * wy * wr * wb
    d = w[..., None] * MUZZLE_SHIFT
    # lower half of the pads a little further forward: a more upright muzzle front, like the reference
    w3 = _ss(-0.018, -0.024, z) * (1.0 - _ss(-0.034, -0.040, z)) * _ss(0.010, 0.020, x) * (1.0 - _ss(0.005, 0.012, np.abs(y)))
    d = d + w3[..., None] * np.array([0.0015, 0.0, 0.0])
    # a cat's "stop": the bridge between the eyes sits further back than the muzzle (reference); 3 mm at most
    w2 = _ss(-0.009, 0.000, z) * (1.0 - _ss(0.005, 0.017, z)) * (1.0 - _ss(0.006, 0.013, np.abs(y))) * _ss(0.004, 0.012, x)
    d = d + w2[..., None] * np.array([-0.0030, 0.0, 0.0])
    return d


def warp(m):
    return m + face_disp(m)


def unwarp(m, it=8):
    p = m.copy()
    for _ in range(it):
        p = m - face_disp(p)
    return p
