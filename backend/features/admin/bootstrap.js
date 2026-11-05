export async function grantAdmin({ uid, operator }, { auth, User, auditedChange }) {
  if (typeof uid !== 'string' || !uid.trim() || typeof operator !== 'string' || !operator.trim())
    throw Error('Provide --uid and --operator explicitly');
  const identity = await auth.getUser(uid);
  if (
    identity.disabled ||
    !identity.email ||
    !identity.emailVerified ||
    !identity.providerData?.some((p) => p.providerId === 'google.com')
  ) {
    throw Error(
      'Target must be an enabled, verified Google account already registered in Firebase Authentication',
    );
  }
  return auditedChange(
    {
      actor: { _id: 'bootstrap-cli', role: 'admin', name: operator.trim() },
      action: 'grant-admin',
      entity: 'user-role',
      entityId: uid,
    },
    async (session) => {
      const previous = await User.findOneAndUpdate(
        { firebaseUid: uid },
        {
          $set: { role: 'admin' },
          $setOnInsert: {
            firebaseUid: uid,
            email: identity.email,
            name: identity.displayName || 'Demo Staff',
          },
        },
        { session, upsert: true, new: false, runValidators: true, setDefaultsOnInsert: true },
      );
      return {
        before: previous ? { firebaseUid: uid, role: previous.role } : null,
        after: { firebaseUid: uid, role: 'admin' },
      };
    },
  );
}
