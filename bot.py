import asyncio
import logging
import os
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, Router, types
from aiogram.filters import Command
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton, FSInputFile

# .env fayldan TOKEN olish (xavfsizlik uchun)
load_dotenv()
TOKEN = os.getenv("BOT_TOKEN")
if not TOKEN:
    raise ValueError("BOT_TOKEN ni .env faylga qo'shing!")

GAME_URL = "https://leveldevil.onrender.com"  # Sizning server URL'ingiz

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(token=TOKEN)
router = Router()
dp = Dispatcher()
dp.include_router(router)

# Neon style screenshot (o'yin tasviri – bepul va mos keladi)
GAME_PHOTO_URL = "https://www.digipen.edu/sites/default/files/styles/digipen_desktop_max/public/public/img/games/01-hero/digipen-student-game-neon-wasteland.jpg.webp?itok=aCVs8Kyl"

@router.message(Command("start"))
async def cmd_start(message: types.Message):
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="🎮 O'YINNI BOSHLASH",
                web_app=WebAppInfo(url=GAME_URL)
            )
        ],
        [
            InlineKeyboardButton(
                text="👥 Do'stlarni Chaqirish",
                switch_inline_query="😈 Devil Troll: Neon Edition – Qiyin multiplayer troll platformer! Birga o'ynaymizmi? 🎮"
            )
        ],
        [
            InlineKeyboardButton(
                text="🏆 Leaderboard & Stats",
                url=f"{GAME_URL}/stats"  # Serveringizdagi stats sahifasi
            )
        ]
    ])

    caption = (
        "🔥 <b>DEVIL TROLL: NEON EDITION</b> 🔥\n\n"
        "😈 Neon cyberpunk uslubidagi <b>multiplayer troll platformer</b>!\n"
        "Tuzoqlar, sawlar, fake pollar... Kim birinchi eshikka yetib boradi?\n"
        "Do'stlaringiz bilan bir vaqtda o'ynang va raqobatlashing!\n\n"
        "👇 <b>Pastdagi tugmani bosing va o'yinni boshlang!</b>"
    )

    await message.answer_photo(
        photo=GAME_PHOTO_URL,
        caption=caption,
        reply_markup=keyboard,
        parse_mode="HTML"
    )

@router.message(Command("help"))
async def cmd_help(message: types.Message):
    text = (
        "<b>Yordam:</b>\n\n"
        "/start – O'yinni boshlash\n"
        "O'yinda: ◀ ▶ harakat, ▲ sakrash\n"
        "Kim birinchi eshikka yetsa – ochko oladi va keyingi levelga o'tiladi!\n\n"
        "Muammo bo'lsa – @sizning_username ga yozing."
    )
    await message.answer(text, parse_mode="HTML")

# Barcha boshqa xabarlarga javob (optional)
@router.message()
async def echo_handler(message: types.Message):
    await message.answer("🎮 O'yinni boshlash uchun /start buyrug'ini bosing!")

async def main():
    logger.info("🤖 Devil Troll Bot ishga tushdi!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())