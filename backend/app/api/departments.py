from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from ..database import get_db
from ..auth import get_current_user
from ..crud import get_all_departments
from ..schemas import DepartmentTree, DepartmentShort
from ..models import User

router = APIRouter(prefix="/departments", tags=["Departments"])


def _build_tree(all_depts):
    id_map = {d.id: DepartmentTree(
        id=d.id, name=d.name, code=d.code or "",
        sort_order=d.sort_order, parent_id=d.parent_id,
        read_only_broadcast=d.read_only_broadcast,
    ) for d in all_depts}
    roots = []
    for d in all_depts:
        node = id_map[d.id]
        if d.parent_id is None:
            roots.append(node)
        else:
            parent = id_map.get(d.parent_id)
            if parent:
                parent.children.append(node)
    return sorted(roots, key=lambda x: x.sort_order)


@router.get("/tree", response_model=List[DepartmentTree])
async def department_tree(
    db: AsyncSession = Depends(get_db),
):
    """Barcha bo'limlar daraxti (ro'yxatdan o'tish uchun ham ishlatiladi)."""
    depts = await get_all_departments(db)
    return _build_tree(depts)


@router.get("/flat", response_model=List[DepartmentShort])
async def department_flat(
    db: AsyncSession = Depends(get_db),
):
    depts = await get_all_departments(db)
    return [
        DepartmentShort(
            id=d.id, name=d.name, code=d.code or "",
            sort_order=d.sort_order, parent_id=d.parent_id,
            read_only_broadcast=d.read_only_broadcast,
        )
        for d in depts
    ]
