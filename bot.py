import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import WebAppInfo

# --- SOZLAMALAR ---
TOKEN = "8483358307:AAEjWziHWTOeTPNxg56yRyZGoVawaM0QSRw"  # BotFather'dan olingan token
GAME_URL = "https://sizning-sayt.onrender.com" # Serveringiz HTTPS manzili

# Loglarni yoqish
logging.basicConfig(level=logging.INFO)

bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def start_handler(message: types.Message):
    markup = types.InlineKeyboardMarkup(inline_keyboard=[
        [
            types.InlineKeyboardButton(
                text="😈 Level Devil O'ynash", 
                web_app=WebAppInfo(url=GAME_URL)
            )
        ]
    ])
    await message.answer(
        "👋 Salom! Do'stingiz bilan 'Level Devil' o'ynashga tayyormisiz?\n\n"
        "Quyidagi tugmani bosing va bir vaqtning o'zida kiring!",
        reply_markup=markup
    )

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())