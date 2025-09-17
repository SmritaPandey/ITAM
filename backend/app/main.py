from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .startup import on_startup
from .routers import assets, users, locations, auth, health, asset_classes, documents, catalogs, procurement, cmdb, vendors_contracts, costs, loans, attributes, reorder, itil_links

app = FastAPI(title="On-Prem Asset Management", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(locations.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(asset_classes.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(catalogs.router, prefix="/api")
app.include_router(procurement.router, prefix="/api")
app.include_router(cmdb.router, prefix="/api")
app.include_router(vendors_contracts.router, prefix="/api")
app.include_router(costs.router, prefix="/api")
app.include_router(loans.router, prefix="/api")
app.include_router(attributes.router, prefix="/api")
app.include_router(reorder.router, prefix="/api")
app.include_router(itil_links.router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    await on_startup()

