module.exports = {
  Redirect: ({ to }) => <div data-testid="redirect" data-to={to} />,
  useHistory: () => ({}),
  useLocation: () => ({}),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
};