# Evidence: RBAC Implementation

Task: T003

## Completed Code
The following middleware was implemented by the `implementation` agent:

```typescript
export const checkRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    // Fallback: If user has no role, assume they are a Viewer
    const userRole = user?.role || 'Viewer';
    
    if (userRole !== requiredRole) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    next();
  };
};
```

## Developer Notes
- Used a higher-order function to inject the required role.
- Assumed 'Viewer' as a fallback if the token is missing a role payload.
