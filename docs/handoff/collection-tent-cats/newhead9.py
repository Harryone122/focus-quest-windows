"""New head for the v8 cat, designed in 'mine' head frame (x fwd, y = cat's left, z up, origin = midpoint
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


NOSE_MINE = np.array([0.0250, 0.0, -0.0128])

# ---------------- eyes (mine frame)
EYE_R = 0.0130
EYE_Y = 0.0228
EYE_X = 0.0005
EYE_YAW = D(17)
EYE_OBL = D(4)
AP_W, AP_H = 0.0122, 0.0118
LID_T = 0.0010          # lid thickness over the globe at the rim
ORB_A0 = 0.0100         # skin limit along the gaze at the rim (globe apex is at EYE_R = 0.013)
ORB_R0 = 0.0125         # radius where the orbit dish starts
ORB_S = 0.62            # how fast the face may rise outward from the rim
ORB_FADE = 0.08         # the dish fades out away from the eye so the nose and cheeks keep their volume


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
    # v9 eyes: the face is pulled back to a shallow orbit around each eyeball (v8 had a deep tube, so the eyes sank
    # in side view). Skin may not come forward of a cone that starts at the lid rim and rises gently outward.
    for s in (1, -1):
        c, f, o, u = eye_axes(s)
        q = p - c
        a = q @ f
        rho = np.sqrt(np.maximum((q * q).sum(-1) - a * a, 0.0))
        amax = ORB_A0 + ORB_S * np.maximum(rho - ORB_R0, 0.0) + ORB_FADE * np.clip((rho - 0.025) / 0.008, 0, 1) ** 2
        cut = (a - amax) / np.sqrt(1 + ORB_S * ORB_S)
        h = smax(h, cut, 0.004)
    return h


def parts(p):
    """component SDFs of the head (mine frame, metres)."""
    d = {}
    cran = ell(p, (-0.024, 0, 0.004), (0.043, 0.046, 0.031))
    cran = smin(cran, ell(p, (-0.034, 0, 0.012), (0.026, 0.034, 0.024)), 0.015)
    cran = smin(cran, ell(p, (-0.007, 0, 0.012), (0.017, 0.030, 0.019)), 0.012)   # v9: forehead set back so the brow no longer hoods the eyes
    # muzzle as a dome: nose tip is the front-most point, everything curves back from it
    bridge = ell(p, (0.0150, 0, -0.0050), (0.0120, 0.0080, 0.0070), rot_y(D(48)))   # v9: narrow ridge rising from the nose to the stop
    cheeks = np.minimum(ell(p, (-0.012, 0.032, -0.011), (0.026, 0.021, 0.021)),
                        ell(p, (-0.012, -0.032, -0.011), (0.026, 0.021, 0.021)))
    jaw = ell(p, (-0.008, 0, -0.021), (0.032, 0.036, 0.016))
    side = np.minimum(ell(p, (0.003, 0.016, -0.011), (0.0095, 0.0095, 0.0085)),
                      ell(p, (0.003, -0.016, -0.011), (0.0095, 0.0095, 0.0085)))
    mbase = ell(p, (0.004, 0, -0.019), (0.0145, 0.0185, 0.0135))
    # whisker pads: tall, reaching up to mid-nose height so the nose sits in the top of the muzzle puff
    pads = np.minimum(ell(p, (0.0152, 0.0090, -0.0220), (0.0094, 0.0100, 0.0105), rot_z(D(26))),
                      ell(p, (0.0152, -0.0090, -0.0220), (0.0094, 0.0100, 0.0105), rot_z(D(-26))))
    pads = smin(pads, ell(p, (0.0165, 0.0, -0.0238), (0.0078, 0.0075, 0.0070)), 0.005)   # shallow philtrum groove
    nose = ell(p, NOSE_MINE, (0.0047, 0.0056, 0.0038), rot_y(D(-12)))
    chin = ell(p, (0.0125, 0, -0.0318), (0.0092, 0.0108, 0.0068))
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
    h = smin(h, chin, 0.007)
    for s in (1, -1):
        c, f, o, u = eye_axes(s)
        h = smin(h, np.linalg.norm(p - c, axis=-1) - (EYE_R + LID_T), 0.003)
    for s in (1, -1):
        c, f, o, u = eye_axes(s)
        q = p - c
        a = q @ f
        b = q @ o
        cc = q @ u
        hh = np.where(cc > 0, AP_H, AP_H * 0.93)
        tb = np.clip(b / AP_W, -1.5, 1.5)
        pinch = np.where(b < 0, 1.0 - 0.12 * tb * tb, 1.0 - 0.04 * tb * tb)
        hh = hh * np.maximum(pinch, 0.25)
        e = np.sqrt((b / AP_W) ** 2 + (cc / hh) ** 2) - 1.0
        tun = np.maximum(e * np.minimum(AP_W, hh), -(a - 0.0015))
        h = smax(h, -tun, 0.0012)
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
PAD_MINE = np.array([0.0152, 0.0090, -0.0220])
