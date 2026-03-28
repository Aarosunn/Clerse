from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.health import router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"app": "clerse", "status": "running"}


app.include_router(router)
