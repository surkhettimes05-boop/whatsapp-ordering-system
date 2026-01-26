/// <reference types="cypress" />

describe('Login Flow', () => {
  it('should successfully log in an admin user and redirect to the dashboard', () => {
    // Start at the login page
    cy.visit('/'); // Assumes the root redirects to login or is the login page

    // Find the form fields and type into them
    cy.get('input[type="tel"]').type('+9779800000000');
    cy.get('input[type="password"]').type('admin123');

    // Submit the form
    cy.get('button[type="submit"]').click();

    // After login, the URL should be the dashboard
    // Note: The login logic in Login.jsx navigates to '/dashboard'
    cy.url().should('include', '/dashboard');

    // The dashboard should contain a specific heading
    cy.get('h2').should('contain', '📊 Dashboard Overview');

    // Check for a specific element from the dashboard to be sure
    cy.contains('.stat-card h3', 'Orders Today').should('be.visible');
  });

  it('should show an error on failed login', () => {
    // Intercept the API call to simulate a failed login
    // This is a more advanced test that requires knowing the API endpoint from `useAuth` context
    // For now, we'll just test with wrong credentials and look for an error message.
    cy.visit('/');

    cy.get('input[type="tel"]').type('+1234567890');
    cy.get('input[type="password"]').type('wrongpassword');

    cy.get('button[type="submit"]').click();

    // The component shows an error div
    cy.get('.bg-red-50').should('be.visible');
  });
});
