// Simple error classes
class AppError extends Error {
	constructor(message, type = 'UNKNOWN_ERROR') {
		super(message);
		this.name = 'AppError';
		this.type = type;
	}
}

const ErrorTypes = {
	NOT_FOUND: 'NOT_FOUND',
	INVALID_REQUEST: 'INVALID_REQUEST',
	INVALID_STATE: 'INVALID_STATE',
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN',
	CONFLICT: 'CONFLICT',
	INTERNAL_ERROR: 'INTERNAL_ERROR'
};

module.exports = {
	AppError,
	ErrorTypes
};
