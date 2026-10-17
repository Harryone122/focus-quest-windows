"""v10 head (from v9, from the v8 head) for the cat, designed in 'mine' head frame (x fwd, y = cat's left, z up, origin = midpoint
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
    mbase = ell(p, (0.0080, 0, -0.0215), (0.0165, 0.0190, 0.0145))
    # whisker pads: tall, reaching up to mid-nose height so the nose sits in the top of the muzzle puff
    # v10: pads further forward and rounder, so the muzzle reads as a clear puff in profile (just behind the nose tip)
    pads = np.minimum(ell(p, PAD_MINE * np.array([1, 1, 1]), (0.0106, 0.0106, 0.0112), rot_z(D(22))),
                      ell(p, PAD_MINE * np.array([1, -1, 1]), (0.0106, 0.0106, 0.0112), rot_z(D(-22))))
    pads = smin(pads, ell(p, (0.0205, 0.0, -0.0236), (0.0080, 0.0076, 0.0072)), 0.005)   # shallow philtrum groove
    nose = ell(p, NOSE_MINE, (0.0047, 0.0056, 0.0038), rot_y(D(-12)))
    chin = ell(p, (0.0172, 0, -0.0322), (0.0104, 0.0112, 0.0084))   # v10: fuller chin so the closed muzzle is one round curve in profile
    chin = smin(chin, ell(p, (0.0040, 0, -0.0360), (0.0170, 0.0165, 0.0085)), 0.008)   # v10: fills the scoop under the jaw
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


# ---------------- v10 mouth: lower jaw on a hinge (mine frame, metres) ----------------
# The mesh is built with the jaw open by THETA0; the shader rotates the jaw shut at rest and opens it for a yawn.
# Sagittal polar coordinates about the hinge: r, phi = atan2(z - hz, x - hx). The closed mouth line is phi = phim(r).
HINGE = np.array([-0.012, -0.024])          # (x, z) of the jaw joint, level with the mouth line, behind the corner
THETA0 = D(14)                              # modelled gape (small: the rest pose closes it with little skin folding)
ML_R = (0.0171, 0.0393)                     # mouth corner / front lip radius from the hinge
ML_PHI = (D(-20.6), D(-6.6))
GAPE_XC, GAPE_HALF = 0.002, 0.0165           # opening as wide as the whisker pads; behind / beside it the cheek skin stretches
JAW_BOTTOM = ((0.022, D(-78)), (0.036, D(-40)))   # closed under-jaw line (r, phi): the jaw weight fades out below it


def polar(m):
    dx = m[..., 0] - HINGE[0]
    dz = m[..., 2] - HINGE[1]
    return np.hypot(dx, dz), np.arctan2(dz, dx)


def phim(r, y=None):
    t = np.clip((r - ML_R[0]) / (ML_R[1] - ML_R[0]), -0.6, 1.4)
    p = ML_PHI[0] + (ML_PHI[1] - ML_PHI[0]) * t
    if y is not None:
        # ω upper lip: the two whisker pads hang a little lower, the middle (under the philtrum) is notched up
        ay = np.abs(y)
        dz = -0.0013 * np.exp(-((ay - 0.0082) / 0.0045) ** 2) + 0.0010 * np.exp(-(ay / 0.0022) ** 2)
        p = p + dz * np.clip((t - 0.35) / 0.4, 0, 1) / np.maximum(r, 0.005)
    return p


def gape_in(r, y):
    """signed depth inside the mouth region (metres, > 0 inside): everything in front of the mouth corners
    (x > GAPE_XC on the closed mouth line), across the whole face width; rounded at the corners."""
    x = HINGE[0] + r * np.cos(phim(r))
    a = x - GAPE_XC
    b = GAPE_HALF - np.abs(y)
    k = 0.003
    hk = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - hk) + a * hk - k * hk * (1 - hk)


def _sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def jaw_map(m):
    """open-pose point -> (closed-pose point, jaw weight w, wedge field E (>0 = empty mouth gap))."""
    r, ph = polar(m)
    pm = phim(r, m[..., 1])
    g = _sstep(-0.0010, 0.0010, gape_in(r, m[..., 1]))
    rb = np.clip((r - JAW_BOTTOM[0][0]) / (JAW_BOTTOM[1][0] - JAW_BOTTOM[0][0]), 0, 1)
    pb = JAW_BOTTOM[0][1] + (JAW_BOTTOM[1][1] - JAW_BOTTOM[0][1]) * rb
    region = _sstep(pb - THETA0 - D(30), pb - THETA0 + D(4), ph) * _sstep(0.006, 0.016, r)
    region = region * (1.0 - _sstep(0.046, 0.060, r)) * _sstep(-0.072, -0.050, m[..., 2])   # head only: never the chest or paws
    lin = np.clip((pm - ph) / THETA0, 0, 1)
    step = _sstep(pm - THETA0 * 0.55, pm - THETA0 * 0.45, ph)
    step = 1.0 - step
    w = region * (g * step + (1 - g) * lin)
    a = THETA0 * w
    dx = m[..., 0] - HINGE[0]
    dz = m[..., 2] - HINGE[1]
    ca, sa = np.cos(a), np.sin(a)
    mc = np.stack([HINGE[0] + dx * ca - dz * sa, m[..., 1], HINGE[1] + dx * sa + dz * ca], -1)
    wedge = np.minimum(ph - (pm - THETA0), pm - ph) * r
    E = np.minimum(np.minimum(wedge, gape_in(r, m[..., 1])), np.minimum(r - 0.010, 0.050 - r))   # mouth gap only inside the head
    E = np.maximum(E, cavity(m, mc, w))
    return mc, w, E


def cavity(m, mc, w):
    """> 0 inside the rounded mouth cavity: a palate dome above the mouth line (upper jaw frame) and a bowl
    below it (lower jaw frame). Both stay inside the shut head, so they only show when the mouth opens."""
    r_u, ph_u = polar(m)                       # upper jaw: open pose == closed pose
    r_l, ph_l = polar(rot_close(m))            # lower jaw seen in its closed frame
    out = []
    for rr, ph, yy, sgn in ((r_u, ph_u, m[..., 1], 1.0), (r_l, ph_l, m[..., 1], -1.0)):
        n = (ph - phim(rr)) * rr * sgn            # height above (dome) / depth below (bowl) the mouth line
        s_ = (rr - 0.027) / 0.0125
        lat = yy / (0.0125 * np.sqrt(np.clip(1.0 - 0.35 * s_, 0.2, 2)))
        dep = 0.0042 if sgn > 0 else 0.0030
        k = np.sqrt(s_ * s_ + lat * lat + (np.maximum(n, 0) / dep) ** 2 + (np.minimum(n, 0) / 0.0015) ** 2)
        out.append((1.0 - k) * 0.004)
    up = np.where(w < 0.5, out[0], -1.0)
    lo = np.where(w >= 0.5, out[1], -1.0)
    return np.maximum(up, lo)


def rot_close(m, a=THETA0):
    dx = m[..., 0] - HINGE[0]
    dz = m[..., 2] - HINGE[1]
    ca, sa = np.cos(a), np.sin(a)
    return np.stack([HINGE[0] + dx * ca - dz * sa, m[..., 1], HINGE[1] + dx * sa + dz * ca], -1)


# tongue, in the closed pose of the lower jaw: lies on the mouth floor, its top half inside the upper jaw when shut
TONGUE_R = (0.0190, 0.0385)                 # back / tip radius from the hinge
TONGUE_W, TONGUE_T = 0.0085, 0.0036


def tongue_closed(mc):
    r, ph = polar(mc)
    rm = 0.5 * (TONGUE_R[0] + TONGUE_R[1])
    hl = 0.5 * (TONGUE_R[1] - TONGUE_R[0])
    # floor-aligned local coordinates: s along the floor, n normal to it (up), y lateral
    s = (r - rm) / hl
    n = (ph - phim(r)) * r + 0.0004
    width = TONGUE_W * np.sqrt(np.clip(1.15 - 0.55 * np.clip(s, -1, 1) ** 2 - 0.15 * s, 0.05, 2))
    q = np.stack([s, mc[..., 1] / width, n / TONGUE_T], -1)
    k = np.linalg.norm(q, axis=-1)
    groove = 0.0006 * np.exp(-(mc[..., 1] / 0.0018) ** 2) * (n > 0)       # shallow centre groove on top
    return (k - 1.0) * min(hl, TONGUE_T) + groove


def tongue_open(m):
    return tongue_closed(rot_close(m))


def tongue_param(mc):
    """0 at the tongue root -> 1 at the tip (closed pose)."""
    r, _ = polar(mc)
    return np.clip((r - TONGUE_R[0]) / (TONGUE_R[1] - TONGUE_R[0]), 0, 1)


# teeth (closed pose, mine frame): (base, tip, radius, jaw) — jaw 0 = upper, 1 = lower
TEETH = []
for s in (1, -1):
    TEETH.append(((0.0236, s * 0.0090, -0.0268), (0.0246, s * 0.0086, -0.0340), 0.00135, 0))   # upper canines
    TEETH.append(((0.0218, s * 0.0074, -0.0322), (0.0216, s * 0.0078, -0.0270), 0.0011, 1))   # lower canines
    for k, yy in enumerate((0.0012, 0.0030, 0.0047)):
        TEETH.append(((0.0262 - 0.0006 * k, s * yy, -0.0270), (0.0263 - 0.0006 * k, s * yy, -0.0290), 0.00045, 0))
        TEETH.append(((0.0242 - 0.0006 * k, s * yy, -0.0306), (0.0244 - 0.0006 * k, s * yy, -0.0288), 0.00040, 1))
