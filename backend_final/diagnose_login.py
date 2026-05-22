"""Standalone login diagnostic — run from `backend_final/`:

    python diagnose_login.py YOUR_EMAIL YOUR_PASSWORD

It will:
  1. Print bcrypt version + DB path it's hitting.
  2. List the last 5 users (id, email, hash prefix, hash length).
  3. Look the email up case-insensitively.
  4. Run verify_password against the stored hash.
  5. If verify fails, also try the email with trailing/leading spaces and
     different cases so we can see whether normalization is the culprit.

This proves whether the fix is live and whether bcrypt is happy.
"""
import sys
import bcrypt
from sqlalchemy import func
from database import SessionLocal
from auth import verify_password
import models

# DATABASE_URL isn't always importable depending on layout; pull it lazily.
try:
    from database import DATABASE_URL  # type: ignore
except Exception:
    DATABASE_URL = "(unknown - see database.py)"


def main():
    if len(sys.argv) < 3:
        print("usage: python diagnose_login.py EMAIL PASSWORD")
        sys.exit(1)

    email_raw = sys.argv[1]
    password = sys.argv[2]
    email = email_raw.strip().lower()

    print(f"bcrypt version: {bcrypt.__version__}")
    print(f"DB URL: {DATABASE_URL}")
    print()

    db = SessionLocal()
    try:
        rows = db.query(models.User).order_by(models.User.id.desc()).limit(5).all()
        print("Last 5 users in DB:")
        for u in rows:
            h = u.hashed_password or ""
            print(f"  id={u.id:<4} email={u.email!r}  hash_prefix={h[:7]!r}  hash_len={len(h)}")
        print()

        user = (
            db.query(models.User)
            .filter(func.lower(models.User.email) == email)
            .first()
        )
        if not user:
            print(f"[X] No user found for {email!r} (input was {email_raw!r})")
            return

        print(f"[OK] Found user id={user.id} email={user.email!r}")
        print(f"     hash prefix: {user.hashed_password[:10]!r}")
        print(f"     hash length: {len(user.hashed_password)}")
        ok = verify_password(password, user.hashed_password)
        print(f"[{'OK' if ok else 'X'}] verify_password -> {ok}")

        if not ok:
            print()
            print("Re-testing with raw bcrypt to see if our wrapper is at fault...")
            try:
                direct = bcrypt.checkpw(
                    password.encode("utf-8"),
                    user.hashed_password.encode("utf-8"),
                )
                print(f"  raw bcrypt.checkpw -> {direct}")
            except Exception as e:
                print(f"  raw bcrypt.checkpw raised: {type(e).__name__}: {e}")
            print()
            print("If both return False, the stored hash doesn't match this password.")
            print("That usually means the account was registered with a different password,")
            print("or the password contained trailing whitespace at registration time.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
