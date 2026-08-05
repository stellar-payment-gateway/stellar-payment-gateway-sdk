use soroban_sdk::{contracterror, contracttype, Address, Env};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AdminError {
    Unauthorized = 100,
    AlreadyInitialized = 101,
    NotInitialized = 102,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Role {
    Student = 0,
    Instructor = 1,
    Admin = 2,
}

#[contracttype]
pub enum DataKey {
    Admin,
    UserRole(Address),
}

/// Initialize the contract admin (can only be called once)
pub fn initialize_admin(env: Env, admin: Address) -> Result<(), AdminError> {
    if env.storage().persistent().has(&DataKey::Admin) {
        return Err(AdminError::AlreadyInitialized);
    }
    
    admin.require_auth();
    env.storage().persistent().set(&DataKey::Admin, &admin);
    env.storage().persistent().set(&DataKey::UserRole(admin.clone()), &Role::Admin);
    Ok(())
}

/// Retrieve the contract admin
pub fn get_admin(env: &Env) -> Result<Address, AdminError> {
    env.storage()
        .persistent()
        .get(&DataKey::Admin)
        .ok_or(AdminError::NotInitialized)
}

/// Get role of a user (defaults to Student if unassigned)
pub fn get_role(env: &Env, user: &Address) -> Role {
    env.storage()
        .persistent()
        .get(&DataKey::UserRole(user.clone()))
        .unwrap_or(Role::Student)
}

/// Assign a role to a target address (Admin only)
pub fn set_role(env: Env, caller: Address, target: Address, role: Role) -> Result<(), AdminError> {
    caller.require_auth();
    require_admin(&env, &caller)?;

    env.storage().persistent().set(&DataKey::UserRole(target), &role);
    Ok(())
}

/// Checks if the given caller is the contract Admin
pub fn require_admin(env: &Env, caller: &Address) -> Result<(), AdminError> {
    let admin = get_admin(env)?;
    if caller != &admin && get_role(env, caller) != Role::Admin {
        return Err(AdminError::Unauthorized);
    }
    Ok(())
}

/// Checks if the caller is authorized to create/manage courses (Admin or Instructor)
pub fn require_instructor_or_admin(env: &Env, caller: &Address) -> Result<(), AdminError> {
    let role = get_role(env, caller);
    let admin = get_admin(env)?;

    if caller == &admin || role == Role::Admin || role == Role::Instructor {
        Ok(())
    } else {
        Err(AdminError::Unauthorized)
    }
}