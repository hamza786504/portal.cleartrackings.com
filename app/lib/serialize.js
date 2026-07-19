// Converts Prisma rows into the Mongoose/Mongo-shaped JSON the frontend
// already expects: numeric `id` -> string `_id`, and relation fields that
// mirror Mongoose's populate-or-raw-id duality (present as a nested object
// when included, otherwise as a plain string id).

export function serializeUserRef(user) {
  if (!user) return null;
  const { id, ...rest } = user;
  return { _id: String(id), ...rest };
}

export function serializeUser(user) {
  if (!user) return null;
  const { id, password, ...rest } = user;
  return { _id: String(id), ...rest };
}

export function serializeCase(row) {
  if (!row) return null;
  const { id, doctorId, pickedById, doctor, pickedBy, ...rest } = row;
  return {
    _id: String(id),
    ...rest,
    doctorId: doctor !== undefined ? serializeUserRef(doctor) : doctorId != null ? String(doctorId) : doctorId,
    pickedBy: pickedBy !== undefined ? serializeUserRef(pickedBy) : pickedById != null ? String(pickedById) : null,
  };
}

export function serializeRevision(row) {
  if (!row) return null;
  const { id, doctorId, pickedById, doctor, pickedBy, ...rest } = row;
  return {
    _id: String(id),
    ...rest,
    doctorId: doctor !== undefined ? serializeUserRef(doctor) : doctorId != null ? String(doctorId) : doctorId,
    pickedBy: pickedBy !== undefined ? serializeUserRef(pickedBy) : pickedById != null ? String(pickedById) : null,
  };
}

export function serializeMessage(row) {
  if (!row) return null;
  const { id, senderId, sender, ...rest } = row;
  return {
    _id: String(id),
    ...rest,
    senderId: sender !== undefined ? serializeUserRef(sender) : String(senderId),
  };
}

// A designer's User row plus its `permissionsAsDesigner` relation (each with
// `doctor` included) -> the Mongoose shape where `allowedDoctors` was an
// array of populated doctor refs.
export function serializeDesigner(row) {
  if (!row) return null;
  const { permissionsAsDesigner, ...userRow } = row;
  const base = serializeUser(userRow);
  base.allowedDoctors = (permissionsAsDesigner || []).map((p) => serializeUserRef(p.doctor));
  return base;
}

export function omit(obj, keys) {
  const copy = { ...obj };
  for (const k of keys) delete copy[k];
  return copy;
}

// Designer-facing status for a case that has been reopened as one or more
// revisions: show the latest revision's status, and only fall back to
// "completed" when EVERY revision is completed. Returns null when the case has
// no revisions, so callers can leave the real case status untouched.
export function computeRevisionStatus(revisions) {
  if (!Array.isArray(revisions) || revisions.length === 0) return null;
  const sorted = [...revisions].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const allCompleted = sorted.every((r) => r.status === 'completed');
  return allCompleted ? 'completed' : sorted[0].status;
}
