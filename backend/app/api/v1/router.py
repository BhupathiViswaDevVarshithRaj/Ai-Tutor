from fastapi import APIRouter

from app.api.v1 import auth, conversations, health, lessons, speech, tutor, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(lessons.router)
api_router.include_router(conversations.router)
api_router.include_router(tutor.router)
api_router.include_router(speech.router)
