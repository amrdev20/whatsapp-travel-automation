"use strict";
/**
 * State Machine Service for Travel Booking Chatbot
 * Implements a structured conversation flow with clear state transitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationState = void 0;
var ConversationState;
(function (ConversationState) {
    // Initial states
    ConversationState["INITIAL"] = "INITIAL";
    ConversationState["GREETING_SENT"] = "GREETING_SENT";
    // Information gathering states
    ConversationState["COLLECTING_DESTINATION"] = "COLLECTING_DESTINATION";
    ConversationState["COLLECTING_DATES"] = "COLLECTING_DATES";
    ConversationState["COLLECTING_DEPARTURE"] = "COLLECTING_DEPARTURE";
    ConversationState["COLLECTING_TRAVELERS"] = "COLLECTING_TRAVELERS";
    ConversationState["COLLECTING_RESIDENCE"] = "COLLECTING_RESIDENCE";
    ConversationState["COLLECTING_NATIONALITY"] = "COLLECTING_NATIONALITY";
    // Search and selection states
    ConversationState["READY_TO_SEARCH"] = "READY_TO_SEARCH";
    ConversationState["SEARCHING_PACKAGES"] = "SEARCHING_PACKAGES";
    ConversationState["PACKAGES_DISPLAYED"] = "PACKAGES_DISPLAYED";
    ConversationState["PACKAGE_SELECTED"] = "PACKAGE_SELECTED";
    // Passenger details states
    ConversationState["COLLECTING_PASSENGER_NAME"] = "COLLECTING_PASSENGER_NAME";
    ConversationState["COLLECTING_EMAIL"] = "COLLECTING_EMAIL";
    ConversationState["COLLECTING_PHONE"] = "COLLECTING_PHONE";
    ConversationState["COLLECTING_DOB"] = "COLLECTING_DOB";
    ConversationState["COLLECTING_PASSPORT"] = "COLLECTING_PASSPORT";
    ConversationState["COLLECTING_PASSPORT_EXPIRY"] = "COLLECTING_PASSPORT_EXPIRY";
    // Booking states
    ConversationState["READY_TO_BOOK"] = "READY_TO_BOOK";
    ConversationState["BOOKING_IN_PROGRESS"] = "BOOKING_IN_PROGRESS";
    ConversationState["BOOKING_COMPLETED"] = "BOOKING_COMPLETED";
    ConversationState["BOOKING_FAILED"] = "BOOKING_FAILED";
    // Error states
    ConversationState["ERROR"] = "ERROR";
    ConversationState["TIMEOUT"] = "TIMEOUT";
})(ConversationState || (exports.ConversationState = ConversationState = {}));
class StateMachineService {
    constructor() {
        this.transitions = new Map();
        this.initializeTransitions();
    }
    /**
     * Initialize all valid state transitions
     */
    initializeTransitions() {
        // Initial state transitions
        this.addTransition({
            from: ConversationState.INITIAL,
            to: ConversationState.GREETING_SENT
        });
        this.addTransition({
            from: ConversationState.GREETING_SENT,
            to: ConversationState.COLLECTING_DESTINATION
        });
        // Information collection transitions
        this.addTransition({
            from: ConversationState.COLLECTING_DESTINATION,
            to: ConversationState.COLLECTING_DATES,
            condition: (ctx) => !!ctx.destination
        });
        this.addTransition({
            from: ConversationState.COLLECTING_DATES,
            to: ConversationState.COLLECTING_DEPARTURE,
            condition: (ctx) => !!ctx.checkInDate && !!ctx.checkOutDate
        });
        this.addTransition({
            from: ConversationState.COLLECTING_DEPARTURE,
            to: ConversationState.COLLECTING_TRAVELERS,
            condition: (ctx) => !!ctx.departureCity
        });
        this.addTransition({
            from: ConversationState.COLLECTING_TRAVELERS,
            to: ConversationState.COLLECTING_RESIDENCE,
            condition: (ctx) => ctx.adults !== undefined
        });
        this.addTransition({
            from: ConversationState.COLLECTING_RESIDENCE,
            to: ConversationState.COLLECTING_NATIONALITY,
            condition: (ctx) => !!ctx.countryOfResidence
        });
        this.addTransition({
            from: ConversationState.COLLECTING_NATIONALITY,
            to: ConversationState.READY_TO_SEARCH,
            condition: (ctx) => !!ctx.nationality
        });
        // Search transitions
        this.addTransition({
            from: ConversationState.READY_TO_SEARCH,
            to: ConversationState.SEARCHING_PACKAGES
        });
        this.addTransition({
            from: ConversationState.SEARCHING_PACKAGES,
            to: ConversationState.PACKAGES_DISPLAYED,
            condition: (ctx) => !!ctx.packages && ctx.packages.length > 0
        });
        this.addTransition({
            from: ConversationState.SEARCHING_PACKAGES,
            to: ConversationState.ERROR,
            condition: (ctx) => !ctx.packages || ctx.packages.length === 0
        });
        // Package selection transitions
        this.addTransition({
            from: ConversationState.PACKAGES_DISPLAYED,
            to: ConversationState.PACKAGE_SELECTED,
            condition: (ctx) => ctx.selectedPackageIndex !== undefined
        });
        // Passenger details collection transitions
        this.addTransition({
            from: ConversationState.PACKAGE_SELECTED,
            to: ConversationState.COLLECTING_PASSENGER_NAME
        });
        this.addTransition({
            from: ConversationState.COLLECTING_PASSENGER_NAME,
            to: ConversationState.COLLECTING_EMAIL,
            condition: (ctx) => !!ctx.passengerName
        });
        this.addTransition({
            from: ConversationState.COLLECTING_EMAIL,
            to: ConversationState.COLLECTING_PHONE,
            condition: (ctx) => !!ctx.passengerEmail
        });
        this.addTransition({
            from: ConversationState.COLLECTING_PHONE,
            to: ConversationState.COLLECTING_DOB,
            condition: (ctx) => !!ctx.passengerPhone
        });
        this.addTransition({
            from: ConversationState.COLLECTING_DOB,
            to: ConversationState.COLLECTING_PASSPORT,
            condition: (ctx) => !!ctx.passengerDOB
        });
        this.addTransition({
            from: ConversationState.COLLECTING_PASSPORT,
            to: ConversationState.COLLECTING_PASSPORT_EXPIRY,
            condition: (ctx) => !!ctx.passportNumber
        });
        this.addTransition({
            from: ConversationState.COLLECTING_PASSPORT_EXPIRY,
            to: ConversationState.READY_TO_BOOK,
            condition: (ctx) => !!ctx.passportExpiry
        });
        // Booking transitions
        this.addTransition({
            from: ConversationState.READY_TO_BOOK,
            to: ConversationState.BOOKING_IN_PROGRESS
        });
        this.addTransition({
            from: ConversationState.BOOKING_IN_PROGRESS,
            to: ConversationState.BOOKING_COMPLETED,
            condition: (ctx) => !!ctx.paymentUrl
        });
        this.addTransition({
            from: ConversationState.BOOKING_IN_PROGRESS,
            to: ConversationState.BOOKING_FAILED,
            condition: (ctx) => !!ctx.errorMessage
        });
        // Error recovery transitions
        this.addTransition({
            from: ConversationState.ERROR,
            to: ConversationState.COLLECTING_DESTINATION
        });
        this.addTransition({
            from: ConversationState.BOOKING_FAILED,
            to: ConversationState.READY_TO_BOOK
        });
    }
    /**
     * Add a state transition
     */
    addTransition(transition) {
        const existing = this.transitions.get(transition.from) || [];
        existing.push(transition);
        this.transitions.set(transition.from, existing);
    }
    /**
     * Get the next state based on current context
     */
    getNextState(context) {
        const currentTransitions = this.transitions.get(context.currentState) || [];
        for (const transition of currentTransitions) {
            if (!transition.condition || transition.condition(context)) {
                return transition.to;
            }
        }
        return context.currentState;
    }
    /**
     * Transition to the next state
     */
    async transition(context) {
        const nextState = this.getNextState(context);
        if (nextState !== context.currentState) {
            context.previousState = context.currentState;
            context.currentState = nextState;
            // Execute any transition actions
            const transitions = this.transitions.get(context.previousState) || [];
            for (const transition of transitions) {
                if (transition.to === nextState && transition.action) {
                    await transition.action(context);
                }
            }
        }
        return context;
    }
    /**
     * Get the appropriate prompt for the current state
     */
    getStatePrompt(state, context) {
        const prompts = {
            [ConversationState.INITIAL]: "Welcome to OFFTO Travel! How can I help you today?",
            [ConversationState.GREETING_SENT]: "I'd be happy to help you book your travel. Where would you like to go?",
            [ConversationState.COLLECTING_DESTINATION]: "Which city would you like to visit?",
            [ConversationState.COLLECTING_DATES]: "When would you like to travel? Please provide your check-in and check-out dates.",
            [ConversationState.COLLECTING_DEPARTURE]: "Which city/airport will you be departing from?",
            [ConversationState.COLLECTING_TRAVELERS]: "How many travelers? Please specify adults and children (with ages if applicable).",
            [ConversationState.COLLECTING_RESIDENCE]: "What is your country of residence?",
            [ConversationState.COLLECTING_NATIONALITY]: "What is your nationality?",
            [ConversationState.READY_TO_SEARCH]: "Perfect! I have all your travel details. Let me search for available packages...",
            [ConversationState.SEARCHING_PACKAGES]: context.waitingForApiResponse
                ? "⏳ Still searching... The system is fetching the latest packages for you."
                : "🔍 Searching for the best packages for you...",
            [ConversationState.PACKAGES_DISPLAYED]: "Here are the available packages. Which one would you like to book?",
            [ConversationState.PACKAGE_SELECTED]: "Excellent choice! Now I need to collect your passenger details. What is your full name?",
            [ConversationState.COLLECTING_PASSENGER_NAME]: "Please provide your full name.",
            [ConversationState.COLLECTING_EMAIL]: "What is your email address?",
            [ConversationState.COLLECTING_PHONE]: "What is your phone number?",
            [ConversationState.COLLECTING_DOB]: "What is your date of birth? (Format: YYYY-MM-DD)",
            [ConversationState.COLLECTING_PASSPORT]: "What is your passport number?",
            [ConversationState.COLLECTING_PASSPORT_EXPIRY]: "When does your passport expire? (Format: YYYY-MM-DD)",
            [ConversationState.READY_TO_BOOK]: "Perfect! I have all your details. Let me create your booking...",
            [ConversationState.BOOKING_IN_PROGRESS]: context.waitingForApiResponse
                ? "⏳ Still processing... Creating your booking and payment link."
                : "📝 Processing your booking...",
            [ConversationState.BOOKING_COMPLETED]: `✅ Great news! Your booking is complete.\n\n💳 Payment Link:\n${context.paymentUrl}`,
            [ConversationState.BOOKING_FAILED]: `❌ I'm sorry, there was an issue with your booking: ${context.errorMessage}.\n\nWould you like to try again?`,
            [ConversationState.ERROR]: "I encountered an issue. Let's start over. Where would you like to travel?",
            [ConversationState.TIMEOUT]: "The session has timed out. Please start a new conversation."
        };
        return prompts[state] || "How can I help you?";
    }
    /**
     * Determine if we should make an API call based on the current state
     */
    shouldCallAPI(state) {
        if (state === ConversationState.SEARCHING_PACKAGES) {
            return 'search';
        }
        if (state === ConversationState.BOOKING_IN_PROGRESS) {
            return 'book';
        }
        return null;
    }
    /**
     * Check if all required information is collected for the current state
     */
    isStateComplete(context) {
        switch (context.currentState) {
            case ConversationState.COLLECTING_DESTINATION:
                return !!context.destination;
            case ConversationState.COLLECTING_DATES:
                return !!context.checkInDate && !!context.checkOutDate;
            case ConversationState.COLLECTING_DEPARTURE:
                return !!context.departureCity;
            case ConversationState.COLLECTING_TRAVELERS:
                return context.adults !== undefined;
            case ConversationState.COLLECTING_RESIDENCE:
                return !!context.countryOfResidence;
            case ConversationState.COLLECTING_NATIONALITY:
                return !!context.nationality;
            case ConversationState.PACKAGES_DISPLAYED:
                return context.selectedPackageIndex !== undefined;
            case ConversationState.COLLECTING_PASSENGER_NAME:
                return !!context.passengerName;
            case ConversationState.COLLECTING_EMAIL:
                return !!context.passengerEmail;
            case ConversationState.COLLECTING_PHONE:
                return !!context.passengerPhone;
            case ConversationState.COLLECTING_DOB:
                return !!context.passengerDOB;
            case ConversationState.COLLECTING_PASSPORT:
                return !!context.passportNumber;
            case ConversationState.COLLECTING_PASSPORT_EXPIRY:
                return !!context.passportExpiry;
            default:
                return true;
        }
    }
    /**
     * Reset the conversation to initial state
     */
    resetConversation() {
        return {
            currentState: ConversationState.INITIAL,
            apiCallAttempts: 0
        };
    }
    /**
     * Create a summary of the current context for debugging
     */
    getContextSummary(context) {
        const summary = {
            state: context.currentState,
            destination: context.destination,
            dates: context.checkInDate && context.checkOutDate ? `${context.checkInDate} to ${context.checkOutDate}` : null,
            departure: context.departureCity,
            travelers: context.adults ? `${context.adults} adults` : null,
            residence: context.countryOfResidence,
            nationality: context.nationality,
            packageSelected: context.selectedPackageIndex !== undefined,
            passengerDetails: {
                name: context.passengerName,
                email: context.passengerEmail,
                phone: context.passengerPhone,
                dob: context.passengerDOB,
                passport: context.passportNumber,
                passportExpiry: context.passportExpiry
            },
            paymentUrl: context.paymentUrl
        };
        return JSON.stringify(summary, null, 2);
    }
}
exports.default = new StateMachineService();
