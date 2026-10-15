import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = os.path.abspath("ads_creatives")
os.makedirs(OUTPUT_DIR, exist_ok=True)

LOGO_PATH = os.path.abspath("adminDashboard/public/android-chrome-512x512.png")
WIN_FONTS = os.environ.get("WINDIR", "C:\\Windows") + "\\Fonts"

FONT_BOLD = os.path.join(WIN_FONTS, "segoeuib.ttf")
FONT_REGULAR = os.path.join(WIN_FONTS, "segoeui.ttf")
FONT_BLACK = os.path.join(WIN_FONTS, "ariblk.ttf") if os.path.exists(os.path.join(WIN_FONTS, "ariblk.ttf")) else FONT_BOLD

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

def draw_gradient(draw, width, height, start_color, end_color, vertical=True):
    r1, g1, b1 = start_color
    r2, g2, b2 = end_color
    if vertical:
        for y in range(height):
            ratio = y / max(1, height)
            r = int(r1 + (r2 - r1) * ratio)
            g = int(g1 + (g2 - g1) * ratio)
            b = int(b1 + (b2 - b1) * ratio)
            draw.line([(0, y), (width, y)], fill=(r, g, b))
    else:
        for x in range(width):
            ratio = x / max(1, width)
            r = int(r1 + (r2 - r1) * ratio)
            g = int(g1 + (g2 - g1) * ratio)
            b = int(b1 + (b2 - b1) * ratio)
            draw.line([(x, 0), (x, height)], fill=(r, g, b))

def add_glow(base_img, center_x, center_y, radius, color, alpha=100):
    glow = Image.new("RGBA", base_img.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    bbox = [center_x - radius, center_y - radius, center_x + radius, center_y + radius]
    glow_draw.ellipse(bbox, fill=(*color, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=radius // 2))
    base_img.alpha_composite(glow)

def draw_pill(draw, x, y, text, font, bg_color, text_color, padding_x=24, padding_y=12):
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    w = tw + padding_x * 2
    h = th + padding_y * 2
    draw.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=bg_color)
    draw.text((x + padding_x, y + padding_y - bbox[1]), text, font=font, fill=text_color)
    return w, h

def draw_play_badge(draw, x, y, width=220, height=64, bg_color=(0, 0, 0), text_color=(255, 255, 255)):
    draw.rounded_rectangle([x, y, x + width, y + height], radius=16, fill=bg_color, outline=(255, 255, 255, 60), width=1)
    
    # Draw Play triangle icon
    icon_x = x + 20
    icon_y = y + height // 2
    points = [(icon_x, icon_y - 14), (icon_x + 22, icon_y), (icon_x, icon_y + 14)]
    draw.polygon(points, fill=(255, 122, 0))
    
    f_sub = get_font(FONT_REGULAR, 12)
    f_main = get_font(FONT_BOLD, 19)
    draw.text((x + 54, y + 10), "GET IT ON", font=f_sub, fill=(180, 180, 180))
    draw.text((x + 54, y + 26), "Google Play", font=f_main, fill=text_color)

def draw_metric_card(draw, x, y, w, h, title, metric, sub, bg_color=(255, 255, 255, 18), border_color=(255, 122, 0, 90)):
    draw.rounded_rectangle([x, y, x + w, y + h], radius=20, fill=bg_color, outline=border_color, width=2)
    f_title = get_font(FONT_BOLD, 16)
    f_metric = get_font(FONT_BLACK, 36)
    f_sub = get_font(FONT_REGULAR, 14)
    
    draw.text((x + 24, y + 18), title, font=f_title, fill=(255, 180, 120))
    draw.text((x + 24, y + 42), metric, font=f_metric, fill=(255, 255, 255))
    draw.text((x + 24, y + 92), sub, font=f_sub, fill=(200, 200, 200))

# 20 Poster Configurations
CONFIGS = [
    # --- LANDSCAPE (1200 x 628) ---
    {
        "filename": "01_landscape_creator_rewards_1200x628.png",
        "size": (1200, 628),
        "theme": "dark",
        "pill": "💰 CREATOR REWARDS PROGRAM",
        "headline": "Upload Videos.\nEarn Creator Rewards.",
        "subhead": "Join India's creator-first platform. Monetize your content with zero fee.",
        "card_title": "Monthly Creator Payout",
        "card_metric": "₹28,500",
        "card_sub": "Direct bank transfer • Weekly payouts",
        "stats": "50K+ Installs • 80K+ Videos • 4.7★",
    },
    {
        "filename": "02_landscape_monetize_talent_1200x628.png",
        "size": (1200, 628),
        "theme": "orange",
        "pill": "🚀 WATCH • CREATE • GROW • EARN",
        "headline": "Turn Your Passion\nInto Daily Earnings.",
        "subhead": "Share short videos in Hindi, Bhojpuri, Punjabi, Tamil & Telugu.",
        "card_title": "Top Creator Earnings",
        "card_metric": "₹42,000+",
        "card_sub": "Earn on every 10K views",
        "stats": "Made for Indian Creators 🇮🇳",
    },
    {
        "filename": "03_landscape_zero_views_solved_1200x628.png",
        "size": (1200, 628),
        "theme": "dark",
        "pill": "🔥 FAIR ALGORITHM GUARANTEE",
        "headline": "Tired of 0 Views\non Other Apps?",
        "subhead": "Bideo boosts fresh Indian creators. Get real reach and real followers.",
        "card_title": "Fresh Creator Reach",
        "card_metric": "1.2M Views",
        "card_sub": "Surfaced to regional audiences",
        "stats": "50K+ Downloads • 4.7 ★ Rating",
    },
    {
        "filename": "04_landscape_trending_entertainment_1200x628.png",
        "size": (1200, 628),
        "theme": "orange",
        "pill": "🎬 100% FREE ENTERTAINMENT",
        "headline": "Watch Unlimited\nTrending Indian Shorts",
        "subhead": "Comedy, Dance, Romance, Shayari & Daily Vlogs with zero buffering.",
        "card_title": "Active Indian Users",
        "card_metric": "50,000+",
        "card_sub": "80,000+ Videos Published",
        "stats": "Watch & Earn Rewards Daily",
    },
    {
        "filename": "05_landscape_payout_guarantee_1200x628.png",
        "size": (1200, 628),
        "theme": "dark",
        "pill": "⚡ FAST CREATOR WITHDRAWALS",
        "headline": "Create Content.\nGet Paid Weekly.",
        "subhead": "Bideo Creator Pool is open now. Download and start earning today.",
        "card_title": "Verified Creators",
        "card_metric": "4.7 ★★★★★",
        "card_sub": "Trusted by 50,000+ Indians",
        "stats": "Available on Google Play",
    },
    {
        "filename": "06_landscape_regional_languages_1200x628.png",
        "size": (1200, 628),
        "theme": "dark",
        "pill": "🇮🇳 MULTI-LANGUAGE PLATFORM",
        "headline": "Your Language.\nYour Stage. Your Fans.",
        "subhead": "Hindi, Bhojpuri, Tamil, Telugu, Punjabi, Gujarati & Marathi creators.",
        "card_title": "Creator Community",
        "card_metric": "80K+ Videos",
        "card_sub": "Daily viral shorts & reels",
        "stats": "100% Free • High-Speed Streaming",
    },
    {
        "filename": "07_landscape_install_now_1200x628.png",
        "size": (1200, 628),
        "theme": "orange",
        "pill": "🌟 INDIA'S NEW SHORT VIDEO APP",
        "headline": "Bideo: Watch, Create\nand Grow Daily.",
        "subhead": "Download on Google Play. Discover India's freshest talents right now.",
        "card_title": "Play Store Rating",
        "card_metric": "4.7 ★",
        "card_sub": "50,000+ Installs and growing",
        "stats": "Download Free on Google Play",
    },

    # --- SQUARE (1200 x 1200) ---
    {
        "filename": "08_square_creator_rewards_1200x1200.png",
        "size": (1200, 1200),
        "theme": "dark",
        "pill": "💰 CREATOR REWARDS PROGRAM",
        "headline": "Upload Videos.\nEarn Real\nRewards.",
        "subhead": "Don't let your creativity go unpaid. Bideo pays you for views, engagement, and follower growth.",
        "card_title": "Creator Monthly Pool",
        "card_metric": "₹35,000",
        "card_sub": "Direct bank transfer • 100% transparent",
        "stats": "50K+ Installs • 80K+ Videos • 4.7★ Rating",
    },
    {
        "filename": "09_square_turn_passion_into_cash_1200x1200.png",
        "size": (1200, 1200),
        "theme": "orange",
        "pill": "🔥 WATCH • CREATE • GROW • EARN",
        "headline": "Turn Your Talent\nInto Daily\nPayouts.",
        "subhead": "Create short reels in your mother tongue. Connect with passionate fans across India.",
        "card_title": "Average Creator Payout",
        "card_metric": "₹15,000 - ₹50,000",
        "card_sub": "Top creators earn weekly rewards",
        "stats": "Join 50,000+ Indian Creators Today",
    },
    {
        "filename": "10_square_tired_of_zero_views_1200x1200.png",
        "size": (1200, 1200),
        "theme": "dark",
        "pill": "🚀 FAIR ALGORITHM FOR ALL",
        "headline": "Tired of 0 Views\non Other Apps?",
        "subhead": "Bideo prioritizes fresh creators. Get discovered by real Indian viewers from day one.",
        "card_title": "Fresh Creator Impressions",
        "card_metric": "500K+ Views",
        "card_sub": "Zero follower bias • Instant viral reach",
        "stats": "50,000+ Installs • 4.7 ★ on Google Play",
    },
    {
        "filename": "11_square_trending_shorts_1200x1200.png",
        "size": (1200, 1200),
        "theme": "dark",
        "pill": "🎬 UNLIMITED ENTERTAINMENT",
        "headline": "India's Freshest\nShort Video\nCommunity.",
        "subhead": "Watch trending comedy, dance, songs, and vlogs with zero buffering on mobile.",
        "card_title": "Published Videos",
        "card_metric": "80,000+",
        "card_sub": "Fresh regional videos updated every minute",
        "stats": "Download Free • 100% Made in India",
    },
    {
        "filename": "12_square_earn_with_shorts_1200x1200.png",
        "size": (1200, 1200),
        "theme": "orange",
        "pill": "⚡ CREATOR MONETIZATION LIVE",
        "headline": "Create Shorts.\nGrow Channel.\nEarn Cash.",
        "subhead": "Join India's fastest-growing creator network. Simple upload directly from your phone.",
        "card_title": "Creator Growth Dashboard",
        "card_metric": "+240% Growth",
        "card_sub": "Daily real-time analytics & insights",
        "stats": "50K+ Installs • Rated 4.7 ★ on Play Store",
    },
    {
        "filename": "13_square_regional_pride_1200x1200.png",
        "size": (1200, 1200),
        "theme": "dark",
        "pill": "🇮🇳 PROUDLY MADE FOR INDIA",
        "headline": "Apna Video.\nApni Pehchan.\nApna Platform.",
        "subhead": "Hindi, Bhojpuri, Tamil, Telugu, Punjabi aur regional languages me video banayein aur kamaayein.",
        "card_title": "Regional Creators",
        "card_metric": "10+ Languages",
        "card_sub": "Connecting millions of Indian viewers",
        "stats": "Download on Google Play Today",
    },
    {
        "filename": "14_square_bideo_official_brand_1200x1200.png",
        "size": (1200, 1200),
        "theme": "dark",
        "pill": "⭐ 4.7 RATED ON GOOGLE PLAY",
        "headline": "Bideo: Watch.\nCreate. Grow.\nEarn Rewards.",
        "subhead": "Join 50,000+ users. The modern mobile-first video sharing platform built for Indian creators.",
        "card_title": "Play Store Community",
        "card_metric": "50,000+ Users",
        "card_sub": "80,000+ Videos • 4.7 ★★★★★",
        "stats": "Get it Free on Google Play",
    },

    # --- VERTICAL PORTRAIT (1080 x 1920) ---
    {
        "filename": "15_vertical_creator_rewards_1080x1920.png",
        "size": (1080, 1920),
        "theme": "dark",
        "pill": "💰 CREATOR REWARDS PROGRAM",
        "headline": "Upload Videos.\nEarn Real\nCreator\nRewards.",
        "subhead": "Don't post for free! Bideo rewards creators for quality videos, engagement, and follower growth.",
        "card_title": "Monthly Creator Dashboard",
        "card_metric": "₹32,500 Payout",
        "card_sub": "Direct bank transfer • Weekly payments",
        "stats": "50K+ Installs • 80K+ Videos • 4.7★ Rating",
    },
    {
        "filename": "16_vertical_turn_talent_into_payouts_1080x1920.png",
        "size": (1080, 1920),
        "theme": "orange",
        "pill": "🔥 WATCH • CREATE • GROW • EARN",
        "headline": "Turn Your\nPassion Into\nDaily Cash\nPayouts.",
        "subhead": "Upload 9:16 vertical shorts from your phone. Zero setup fee. Monetize from day one.",
        "card_title": "Top Creator Earnings",
        "card_metric": "₹45,000+",
        "card_sub": "Get paid for views and community gifts",
        "stats": "Made for Indian Creators 🇮🇳",
    },
    {
        "filename": "17_vertical_zero_views_solved_1080x1920.png",
        "size": (1080, 1920),
        "theme": "dark",
        "pill": "🚀 FAIR ALGORITHM FOR ALL",
        "headline": "Tired of\n0 Views on\nOther Apps?",
        "subhead": "Bideo's creator recommendation engine showcases fresh Indian creators without celebrity bias.",
        "card_title": "Viral Potential",
        "card_metric": "1.5M Views",
        "card_sub": "Reach local viewers across India",
        "stats": "50,000+ Installs • 4.7 ★ on Google Play",
    },
    {
        "filename": "18_vertical_trending_shorts_1080x1920.png",
        "size": (1080, 1920),
        "theme": "dark",
        "pill": "🎬 UNLIMITED ENTERTAINMENT",
        "headline": "Watch Non-Stop\nTrending Reels\n& Shorts Daily.",
        "subhead": "Fresh comedy, trending dance, love shayari, and entertainment clips in your mother tongue.",
        "card_title": "Video Library",
        "card_metric": "80,000+ Shorts",
        "card_sub": "Buffer-free streaming on mobile networks",
        "stats": "Download Free • 100% Made in India",
    },
    {
        "filename": "19_vertical_creator_dashboard_1080x1920.png",
        "size": (1080, 1920),
        "theme": "orange",
        "pill": "⚡ FAST CREATOR PAYOUTS",
        "headline": "Create Shorts.\nGrow Channel.\nEarn Real\nMoney.",
        "subhead": "Join India's creator revolution. Track views, likes, and earnings on your personal dashboard.",
        "card_title": "Monthly Growth",
        "card_metric": "+350% Reach",
        "card_sub": "Weekly creator payouts direct to bank",
        "stats": "50K+ Installs • 4.7 ★★★★★",
    },
    {
        "filename": "20_vertical_grand_call_to_action_1080x1920.png",
        "size": (1080, 1920),
        "theme": "dark",
        "pill": "⭐ 4.7 RATED ON GOOGLE PLAY",
        "headline": "Bideo:\nWatch. Create.\nGrow. Earn.",
        "subhead": "Over 50,000+ creators and viewers trust Bideo. Download free on Google Play Store today.",
        "card_title": "India's Community",
        "card_metric": "50,000+ Users",
        "card_sub": "80,000+ Videos Published",
        "stats": "Get it Free on Google Play",
    },
]

def render_poster(cfg):
    w, h = cfg["size"]
    theme = cfg["theme"]
    img = Image.new("RGBA", (w, h), (15, 15, 15, 255))
    draw = ImageDraw.Draw(img)

    # 1. Background Gradients & Glows
    if theme == "orange":
        draw_gradient(draw, w, h, (255, 110, 0), (190, 50, 0), vertical=True)
        add_glow(img, w // 2, int(h * 0.3), radius=int(min(w, h) * 0.5), color=(255, 170, 50), alpha=70)
        card_bg = (0, 0, 0, 70)
        card_border = (255, 255, 255, 80)
        pill_bg = (255, 255, 255)
        pill_text = (200, 60, 0)
    else:  # dark theme
        draw_gradient(draw, w, h, (14, 14, 18), (28, 16, 10), vertical=True)
        add_glow(img, int(w * 0.8), int(h * 0.25), radius=int(min(w, h) * 0.45), color=(255, 110, 0), alpha=50)
        add_glow(img, int(w * 0.2), int(h * 0.75), radius=int(min(w, h) * 0.35), color=(255, 75, 0), alpha=35)
        card_bg = (255, 255, 255, 20)
        card_border = (255, 122, 0, 100)
        pill_bg = (255, 122, 0)
        pill_text = (255, 255, 255)

    draw = ImageDraw.Draw(img)

    # 2. Add App Logo
    logo_size = int(min(w, h) * 0.11)
    if os.path.exists(LOGO_PATH):
        try:
            logo_raw = Image.open(LOGO_PATH).convert("RGBA")
            logo = logo_raw.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
            pad_left = int(w * 0.07)
            pad_top = int(h * 0.06)
            img.alpha_composite(logo, (pad_left, pad_top))
            
            # Brand Name next to logo
            f_logo = get_font(FONT_BLACK, int(logo_size * 0.58))
            draw.text((pad_left + logo_size + 16, pad_top + int(logo_size * 0.18)), "Bideo", font=f_logo, fill=(255, 255, 255))
        except Exception as e:
            print("Logo load error:", e)

    # 3. Dynamic layout based on aspect ratio
    pad_left = int(w * 0.07)
    
    if w == 1200 and h == 628:
        # --- LANDSCAPE LAYOUT ---
        # Pill badge
        f_pill = get_font(FONT_BOLD, 14)
        draw_pill(draw, pad_left, 130, cfg["pill"], f_pill, pill_bg, pill_text, padding_x=18, padding_y=8)
        
        # Headline
        f_head = get_font(FONT_BLACK, 46)
        draw.text((pad_left, 185), cfg["headline"], font=f_head, fill=(255, 255, 255), spacing=10)
        
        # Subhead
        f_sub = get_font(FONT_REGULAR, 20)
        draw.text((pad_left, 325), cfg["subhead"], font=f_sub, fill=(220, 220, 220))
        
        # Bottom Badges & CTA
        draw_play_badge(draw, pad_left, 490, width=240, height=72)
        
        f_stat = get_font(FONT_BOLD, 18)
        draw.text((pad_left + 270, 514), cfg["stats"], font=f_stat, fill=(255, 185, 100))
        
        # Floating metric card on right side
        card_w, card_h = 360, 230
        card_x = w - card_w - pad_left
        card_y = 170
        draw_metric_card(draw, card_x, card_y, card_w, card_h, cfg["card_title"], cfg["card_metric"], cfg["card_sub"], bg_color=card_bg, border_color=card_border)
        
    elif w == 1200 and h == 1200:
        # --- SQUARE LAYOUT ---
        f_pill = get_font(FONT_BOLD, 18)
        draw_pill(draw, pad_left, 210, cfg["pill"], f_pill, pill_bg, pill_text, padding_x=24, padding_y=12)
        
        f_head = get_font(FONT_BLACK, 68)
        draw.text((pad_left, 280), cfg["headline"], font=f_head, fill=(255, 255, 255), spacing=14)
        
        f_sub = get_font(FONT_REGULAR, 26)
        # wrap subhead lines manually if long
        draw.text((pad_left, 570), cfg["subhead"], font=f_sub, fill=(220, 220, 220), spacing=8)
        
        # Center/Bottom Metric card
        card_w, card_h = w - (pad_left * 2), 240
        card_x = pad_left
        card_y = 700
        draw_metric_card(draw, card_x, card_y, card_w, card_h, cfg["card_title"], cfg["card_metric"], cfg["card_sub"], bg_color=card_bg, border_color=card_border)
        
        # Bottom Google Play CTA
        draw_play_badge(draw, pad_left, 1010, width=280, height=84)
        
        f_stat = get_font(FONT_BOLD, 22)
        draw.text((pad_left + 320, 1038), cfg["stats"], font=f_stat, fill=(255, 185, 100))

    else:
        # --- VERTICAL (1080 x 1920) LAYOUT ---
        f_pill = get_font(FONT_BOLD, 20)
        draw_pill(draw, pad_left, 300, cfg["pill"], f_pill, pill_bg, pill_text, padding_x=28, padding_y=14)
        
        f_head = get_font(FONT_BLACK, 78)
        draw.text((pad_left, 390), cfg["headline"], font=f_head, fill=(255, 255, 255), spacing=16)
        
        f_sub = get_font(FONT_REGULAR, 32)
        draw.text((pad_left, 820), cfg["subhead"], font=f_sub, fill=(220, 220, 220), spacing=12)
        
        # Center Big Metric Card
        card_w, card_h = w - (pad_left * 2), 300
        card_x = pad_left
        card_y = 1040
        draw_metric_card(draw, card_x, card_y, card_w, card_h, cfg["card_title"], cfg["card_metric"], cfg["card_sub"], bg_color=card_bg, border_color=card_border)
        
        # Secondary Trust Strip
        f_trust = get_font(FONT_BOLD, 28)
        draw.text((pad_left, 1420), "⭐ 4.7 Stars  •  50K+ Installs  •  80K+ Videos", font=f_trust, fill=(255, 190, 80))
        
        # Bottom Google Play CTA
        draw_play_badge(draw, pad_left, 1540, width=360, height=100)
        
        f_bottom = get_font(FONT_REGULAR, 26)
        draw.text((pad_left, 1690), "Free Download • Available across India 🇮🇳", font=f_bottom, fill=(180, 180, 180))

    out_path = os.path.join(OUTPUT_DIR, cfg["filename"])
    img.save(out_path, format="PNG", optimize=True)
    print(f"Generated: {cfg['filename']} ({w}x{h})")

def main():
    print("Starting generation of 20 promotional ad posters...")
    for i, cfg in enumerate(CONFIGS, 1):
        render_poster(cfg)
    print(f"\nAll 20 ad posters generated successfully in: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
