describe('Sample form', () => {
  it('should fail to click submit', () => {
    cy.get('[data-testid="submit-button"]').click();
    cy.get('[data-testid="status"]').should('be.visible');
  });
});
