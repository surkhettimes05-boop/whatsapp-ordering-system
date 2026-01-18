/**
 * ORDER STATE MACHINE VALIDATOR
 * 
 * Validates state transitions and ensures orders follow the strict state machine
 */

const { VALID_TRANSITIONS, TERMINAL_STATES, ORDER_STATES } = require('../constants/orderStates');

class InvalidTransitionError extends Error {
  constructor(message, fromState, toState) {
    super(message);
    this.name = 'InvalidTransitionError';
    this.fromState = fromState;
    this.toState = toState;
  }
}

class TerminalStateError extends Error {
  constructor(message, state) {
    super(message);
    this.name = 'TerminalStateError';
    this.state = state;
  }
}

class OrderStateMachineValidator {
  /**
   * Validate that a transition is allowed
   * 
   * @param {string} currentState - Current order state
   * @param {string} targetState - Desired next state
   * @returns {boolean} True if transition is valid
   * @throws {InvalidTransitionError} If transition is not allowed
   * @throws {TerminalStateError} If current state is terminal
   */
  static validateTransition(currentState, targetState) {
    // Check if current state exists
    if (!Object.values(ORDER_STATES).includes(currentState)) {
      throw new Error(`Invalid current state: ${currentState}`);
    }

    // Check if target state exists
    if (!Object.values(ORDER_STATES).includes(targetState)) {
      throw new Error(`Invalid target state: ${targetState}`);
    }

    // Check if current state is terminal
    if (TERMINAL_STATES.includes(currentState)) {
      throw new TerminalStateError(
        `Cannot transition from terminal state: ${currentState}`,
        currentState
      );
    }

    // Get valid next states
    const validNextStates = VALID_TRANSITIONS[currentState];
    if (!validNextStates || !validNextStates.includes(targetState)) {
      throw new InvalidTransitionError(
        `Invalid transition from ${currentState} to ${targetState}. Valid transitions: ${validNextStates?.join(', ') || 'none'}`,
        currentState,
        targetState
      );
    }

    return true;
  }

  /**
   * Get all valid next states for current state
   * 
   * @param {string} currentState - Current order state
   * @returns {string[]} Array of valid next states
   */
  static getValidNextStates(currentState) {
    if (!Object.values(ORDER_STATES).includes(currentState)) {
      throw new Error(`Invalid state: ${currentState}`);
    }

    return VALID_TRANSITIONS[currentState] || [];
  }

  /**
   * Check if a state is terminal
   * 
   * @param {string} state - Order state to check
   * @returns {boolean} True if state is terminal
   */
  static isTerminalState(state) {
    return TERMINAL_STATES.includes(state);
  }

  /**
   * Check if a state is a failure state
   * 
   * @param {string} state - Order state to check
   * @returns {boolean} True if state is a failure state
   */
  static isFailureState(state) {
    return [ORDER_STATES.FAILED, ORDER_STATES.CANCELLED].includes(state);
  }

  /**
   * Check if an order can still be modified
   * 
   * @param {string} currentState - Current order state
   * @returns {boolean} True if order can be modified
   */
  static canModify(currentState) {
    return !this.isTerminalState(currentState) && currentState !== ORDER_STATES.OUT_FOR_DELIVERY;
  }

  /**
   * Check if an order can be cancelled from current state
   * 
   * @param {string} currentState - Current order state
   * @returns {boolean} True if order can be cancelled
   */
  static canBeCancelled(currentState) {
    const cancellableStates = [
      ORDER_STATES.CREATED,
      ORDER_STATES.CREDIT_APPROVED,
      ORDER_STATES.STOCK_RESERVED,
      ORDER_STATES.WHOLESALER_ACCEPTED,
      ORDER_STATES.OUT_FOR_DELIVERY,
      ORDER_STATES.FAILED
    ];
    return cancellableStates.includes(currentState);
  }
}

module.exports = {
  OrderStateMachineValidator,
  InvalidTransitionError,
  TerminalStateError
};
