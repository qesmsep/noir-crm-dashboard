"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/_app";
exports.ids = ["pages/_app"];
exports.modules = {

/***/ "(pages-dir-node)/./src/components/MainNav.tsx":
/*!************************************!*\
  !*** ./src/components/MainNav.tsx ***!
  \************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ MainNav)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ \"react\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @chakra-ui/react */ \"@chakra-ui/react\");\n/* harmony import */ var next_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! next/link */ \"(pages-dir-node)/./node_modules/next/link.js\");\n/* harmony import */ var next_link__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(next_link__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var _context_AppContext__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../context/AppContext */ \"(pages-dir-node)/./src/context/AppContext.js\");\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__]);\n_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];\n\n\n\n\n\nfunction MainNav() {\n    const { user } = (0,_context_AppContext__WEBPACK_IMPORTED_MODULE_4__.useAppContext)();\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__.Box, {\n        as: \"nav\",\n        position: \"fixed\",\n        top: 0,\n        left: 0,\n        width: \"100%\",\n        zIndex: 100,\n        px: 8,\n        py: 5,\n        display: \"flex\",\n        alignItems: \"center\",\n        justifyContent: \"space-between\",\n        bg: \"rgba(255,255,255,0.20)\",\n        boxShadow: \"sm\",\n        children: [\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__.Image, {\n                src: \"/images/noir-wedding-day.png\",\n                alt: \"Noir\",\n                height: \"48px\",\n                objectFit: \"contain\"\n            }, void 0, false, {\n                fileName: \"/Users/qesmsep/noir-crm-dashboard/src/components/MainNav.tsx\",\n                lineNumber: 10,\n                columnNumber: 7\n            }, this),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__.HStack, {\n                spacing: 2,\n                children: [\n                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__.Button, {\n                        as: (next_link__WEBPACK_IMPORTED_MODULE_3___default()),\n                        href: \"/\",\n                        size: \"sm\",\n                        variant: \"ghost\",\n                        color: \"white\",\n                        children: \"Home\"\n                    }, void 0, false, {\n                        fileName: \"/Users/qesmsep/noir-crm-dashboard/src/components/MainNav.tsx\",\n                        lineNumber: 12,\n                        columnNumber: 9\n                    }, this),\n                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__.Button, {\n                        as: (next_link__WEBPACK_IMPORTED_MODULE_3___default()),\n                        href: \"/members\",\n                        size: \"sm\",\n                        variant: \"ghost\",\n                        color: \"white\",\n                        children: \"Members\"\n                    }, void 0, false, {\n                        fileName: \"/Users/qesmsep/noir-crm-dashboard/src/components/MainNav.tsx\",\n                        lineNumber: 13,\n                        columnNumber: 9\n                    }, this),\n                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__.Button, {\n                        as: (next_link__WEBPACK_IMPORTED_MODULE_3___default()),\n                        href: \"/admin\",\n                        size: \"sm\",\n                        variant: \"ghost\",\n                        color: \"white\",\n                        children: \"Admin\"\n                    }, void 0, false, {\n                        fileName: \"/Users/qesmsep/noir-crm-dashboard/src/components/MainNav.tsx\",\n                        lineNumber: 14,\n                        columnNumber: 9\n                    }, this),\n                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__.Button, {\n                        as: (next_link__WEBPACK_IMPORTED_MODULE_3___default()),\n                        href: \"/reserve\",\n                        size: \"sm\",\n                        colorScheme: \"blue\",\n                        color: \"white\",\n                        children: \"Book Now\"\n                    }, void 0, false, {\n                        fileName: \"/Users/qesmsep/noir-crm-dashboard/src/components/MainNav.tsx\",\n                        lineNumber: 15,\n                        columnNumber: 9\n                    }, this),\n                    user && /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_2__.Button, {\n                        as: (next_link__WEBPACK_IMPORTED_MODULE_3___default()),\n                        href: \"/admin/logout\",\n                        size: \"sm\",\n                        colorScheme: \"red\",\n                        color: \"white\",\n                        children: \"Logout\"\n                    }, void 0, false, {\n                        fileName: \"/Users/qesmsep/noir-crm-dashboard/src/components/MainNav.tsx\",\n                        lineNumber: 17,\n                        columnNumber: 11\n                    }, this)\n                ]\n            }, void 0, true, {\n                fileName: \"/Users/qesmsep/noir-crm-dashboard/src/components/MainNav.tsx\",\n                lineNumber: 11,\n                columnNumber: 7\n            }, this)\n        ]\n    }, void 0, true, {\n        fileName: \"/Users/qesmsep/noir-crm-dashboard/src/components/MainNav.tsx\",\n        lineNumber: 9,\n        columnNumber: 5\n    }, this);\n}\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHBhZ2VzLWRpci1ub2RlKS8uL3NyYy9jb21wb25lbnRzL01haW5OYXYudHN4IiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBMEI7QUFDb0M7QUFDakM7QUFDeUI7QUFFdkMsU0FBU087SUFDdEIsTUFBTSxFQUFFQyxJQUFJLEVBQUUsR0FBR0Ysa0VBQWFBO0lBQzlCLHFCQUNFLDhEQUFDTCxpREFBR0E7UUFBQ1EsSUFBRztRQUFNQyxVQUFTO1FBQVFDLEtBQUs7UUFBR0MsTUFBTTtRQUFHQyxPQUFNO1FBQU9DLFFBQVE7UUFBS0MsSUFBSTtRQUFHQyxJQUFJO1FBQUdDLFNBQVE7UUFBT0MsWUFBVztRQUFTQyxnQkFBZTtRQUFnQkMsSUFBRztRQUF5QkMsV0FBVTs7MEJBQzlMLDhEQUFDakIsbURBQUtBO2dCQUFDa0IsS0FBSTtnQkFBK0JDLEtBQUk7Z0JBQU9DLFFBQU87Z0JBQU9DLFdBQVU7Ozs7OzswQkFDN0UsOERBQUN2QixvREFBTUE7Z0JBQUN3QixTQUFTOztrQ0FDZiw4REFBQ3ZCLG9EQUFNQTt3QkFBQ00sSUFBSUosa0RBQUlBO3dCQUFFc0IsTUFBSzt3QkFBSUMsTUFBSzt3QkFBS0MsU0FBUTt3QkFBUUMsT0FBTTtrQ0FBUTs7Ozs7O2tDQUNuRSw4REFBQzNCLG9EQUFNQTt3QkFBQ00sSUFBSUosa0RBQUlBO3dCQUFFc0IsTUFBSzt3QkFBV0MsTUFBSzt3QkFBS0MsU0FBUTt3QkFBUUMsT0FBTTtrQ0FBUTs7Ozs7O2tDQUMxRSw4REFBQzNCLG9EQUFNQTt3QkFBQ00sSUFBSUosa0RBQUlBO3dCQUFFc0IsTUFBSzt3QkFBU0MsTUFBSzt3QkFBS0MsU0FBUTt3QkFBUUMsT0FBTTtrQ0FBUTs7Ozs7O2tDQUN4RSw4REFBQzNCLG9EQUFNQTt3QkFBQ00sSUFBSUosa0RBQUlBO3dCQUFFc0IsTUFBSzt3QkFBV0MsTUFBSzt3QkFBS0csYUFBWTt3QkFBT0QsT0FBTTtrQ0FBUTs7Ozs7O29CQUM1RXRCLHNCQUNDLDhEQUFDTCxvREFBTUE7d0JBQUNNLElBQUlKLGtEQUFJQTt3QkFBRXNCLE1BQUs7d0JBQWdCQyxNQUFLO3dCQUFLRyxhQUFZO3dCQUFNRCxPQUFNO2tDQUFROzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFLM0YiLCJzb3VyY2VzIjpbIi9Vc2Vycy9xZXNtc2VwL25vaXItY3JtLWRhc2hib2FyZC9zcmMvY29tcG9uZW50cy9NYWluTmF2LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgQm94LCBIU3RhY2ssIEJ1dHRvbiwgSW1hZ2UgfSBmcm9tICdAY2hha3JhLXVpL3JlYWN0JztcbmltcG9ydCBMaW5rIGZyb20gJ25leHQvbGluayc7XG5pbXBvcnQgeyB1c2VBcHBDb250ZXh0IH0gZnJvbSAnLi4vY29udGV4dC9BcHBDb250ZXh0JztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gTWFpbk5hdigpIHtcbiAgY29uc3QgeyB1c2VyIH0gPSB1c2VBcHBDb250ZXh0KCk7XG4gIHJldHVybiAoXG4gICAgPEJveCBhcz1cIm5hdlwiIHBvc2l0aW9uPVwiZml4ZWRcIiB0b3A9ezB9IGxlZnQ9ezB9IHdpZHRoPVwiMTAwJVwiIHpJbmRleD17MTAwfSBweD17OH0gcHk9ezV9IGRpc3BsYXk9XCJmbGV4XCIgYWxpZ25JdGVtcz1cImNlbnRlclwiIGp1c3RpZnlDb250ZW50PVwic3BhY2UtYmV0d2VlblwiIGJnPVwicmdiYSgyNTUsMjU1LDI1NSwwLjIwKVwiIGJveFNoYWRvdz1cInNtXCI+XG4gICAgICA8SW1hZ2Ugc3JjPVwiL2ltYWdlcy9ub2lyLXdlZGRpbmctZGF5LnBuZ1wiIGFsdD1cIk5vaXJcIiBoZWlnaHQ9XCI0OHB4XCIgb2JqZWN0Rml0PVwiY29udGFpblwiIC8+XG4gICAgICA8SFN0YWNrIHNwYWNpbmc9ezJ9PlxuICAgICAgICA8QnV0dG9uIGFzPXtMaW5rfSBocmVmPVwiL1wiIHNpemU9XCJzbVwiIHZhcmlhbnQ9XCJnaG9zdFwiIGNvbG9yPVwid2hpdGVcIj5Ib21lPC9CdXR0b24+XG4gICAgICAgIDxCdXR0b24gYXM9e0xpbmt9IGhyZWY9XCIvbWVtYmVyc1wiIHNpemU9XCJzbVwiIHZhcmlhbnQ9XCJnaG9zdFwiIGNvbG9yPVwid2hpdGVcIj5NZW1iZXJzPC9CdXR0b24+XG4gICAgICAgIDxCdXR0b24gYXM9e0xpbmt9IGhyZWY9XCIvYWRtaW5cIiBzaXplPVwic21cIiB2YXJpYW50PVwiZ2hvc3RcIiBjb2xvcj1cIndoaXRlXCI+QWRtaW48L0J1dHRvbj5cbiAgICAgICAgPEJ1dHRvbiBhcz17TGlua30gaHJlZj1cIi9yZXNlcnZlXCIgc2l6ZT1cInNtXCIgY29sb3JTY2hlbWU9XCJibHVlXCIgY29sb3I9XCJ3aGl0ZVwiPkJvb2sgTm93PC9CdXR0b24+XG4gICAgICAgIHt1c2VyICYmIChcbiAgICAgICAgICA8QnV0dG9uIGFzPXtMaW5rfSBocmVmPVwiL2FkbWluL2xvZ291dFwiIHNpemU9XCJzbVwiIGNvbG9yU2NoZW1lPVwicmVkXCIgY29sb3I9XCJ3aGl0ZVwiPkxvZ291dDwvQnV0dG9uPlxuICAgICAgICApfVxuICAgICAgPC9IU3RhY2s+XG4gICAgPC9Cb3g+XG4gICk7XG59ICJdLCJuYW1lcyI6WyJSZWFjdCIsIkJveCIsIkhTdGFjayIsIkJ1dHRvbiIsIkltYWdlIiwiTGluayIsInVzZUFwcENvbnRleHQiLCJNYWluTmF2IiwidXNlciIsImFzIiwicG9zaXRpb24iLCJ0b3AiLCJsZWZ0Iiwid2lkdGgiLCJ6SW5kZXgiLCJweCIsInB5IiwiZGlzcGxheSIsImFsaWduSXRlbXMiLCJqdXN0aWZ5Q29udGVudCIsImJnIiwiYm94U2hhZG93Iiwic3JjIiwiYWx0IiwiaGVpZ2h0Iiwib2JqZWN0Rml0Iiwic3BhY2luZyIsImhyZWYiLCJzaXplIiwidmFyaWFudCIsImNvbG9yIiwiY29sb3JTY2hlbWUiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(pages-dir-node)/./src/components/MainNav.tsx\n");

/***/ }),

/***/ "(pages-dir-node)/./src/context/AppContext.js":
/*!***********************************!*\
  !*** ./src/context/AppContext.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   AppContextProvider: () => (/* binding */ AppContextProvider),\n/* harmony export */   useAppContext: () => (/* binding */ useAppContext)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ \"react\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _pages_api_supabaseClient__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../pages/api/supabaseClient */ \"(pages-dir-node)/./src/pages/api/supabaseClient.js\");\n\n\n\nconst AppContext = /*#__PURE__*/ (0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(null);\nfunction AppContextProvider({ children }) {\n    const [user, setUser] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);\n    const [reservations, setReservations] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)([]);\n    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)({\n        \"AppContextProvider.useEffect\": ()=>{\n            // Check for existing session on mount\n            _pages_api_supabaseClient__WEBPACK_IMPORTED_MODULE_2__.supabase.auth.getSession().then({\n                \"AppContextProvider.useEffect\": ({ data: { session } })=>{\n                    if (session?.user) setUser(session.user);\n                }\n            }[\"AppContextProvider.useEffect\"]);\n            // Listen for login/logout\n            const { data: listener } = _pages_api_supabaseClient__WEBPACK_IMPORTED_MODULE_2__.supabase.auth.onAuthStateChange({\n                \"AppContextProvider.useEffect\": (_event, session)=>{\n                    setUser(session?.user || null);\n                }\n            }[\"AppContextProvider.useEffect\"]);\n            return ({\n                \"AppContextProvider.useEffect\": ()=>{\n                    listener?.subscription?.unsubscribe?.();\n                }\n            })[\"AppContextProvider.useEffect\"];\n        }\n    }[\"AppContextProvider.useEffect\"], []);\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(AppContext.Provider, {\n        value: {\n            user,\n            setUser,\n            reservations,\n            setReservations\n        },\n        children: children\n    }, void 0, false, {\n        fileName: \"/Users/qesmsep/noir-crm-dashboard/src/context/AppContext.js\",\n        lineNumber: 25,\n        columnNumber: 5\n    }, this);\n}\nconst useAppContext = ()=>(0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(AppContext);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHBhZ2VzLWRpci1ub2RlKS8uL3NyYy9jb250ZXh0L0FwcENvbnRleHQuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBOEU7QUFDdkI7QUFFdkQsTUFBTU0sMkJBQWFMLG9EQUFhQSxDQUFDO0FBRTFCLFNBQVNNLG1CQUFtQixFQUFFQyxRQUFRLEVBQUU7SUFDN0MsTUFBTSxDQUFDQyxNQUFNQyxRQUFRLEdBQUdSLCtDQUFRQSxDQUFDO0lBQ2pDLE1BQU0sQ0FBQ1MsY0FBY0MsZ0JBQWdCLEdBQUdWLCtDQUFRQSxDQUFDLEVBQUU7SUFFbkRFLGdEQUFTQTt3Q0FBQztZQUNSLHNDQUFzQztZQUN0Q0MsK0RBQVFBLENBQUNRLElBQUksQ0FBQ0MsVUFBVSxHQUFHQyxJQUFJO2dEQUFDLENBQUMsRUFBRUMsTUFBTSxFQUFFQyxPQUFPLEVBQUUsRUFBRTtvQkFDcEQsSUFBSUEsU0FBU1IsTUFBTUMsUUFBUU8sUUFBUVIsSUFBSTtnQkFDekM7O1lBQ0EsMEJBQTBCO1lBQzFCLE1BQU0sRUFBRU8sTUFBTUUsUUFBUSxFQUFFLEdBQUdiLCtEQUFRQSxDQUFDUSxJQUFJLENBQUNNLGlCQUFpQjtnREFBQyxDQUFDQyxRQUFRSDtvQkFDbEVQLFFBQVFPLFNBQVNSLFFBQVE7Z0JBQzNCOztZQUNBO2dEQUFPO29CQUNMUyxVQUFVRyxjQUFjQztnQkFDMUI7O1FBQ0Y7dUNBQUcsRUFBRTtJQUVMLHFCQUNFLDhEQUFDaEIsV0FBV2lCLFFBQVE7UUFBQ0MsT0FBTztZQUFFZjtZQUFNQztZQUFTQztZQUFjQztRQUFnQjtrQkFDeEVKOzs7Ozs7QUFHUDtBQUVPLE1BQU1pQixnQkFBZ0IsSUFBTXRCLGlEQUFVQSxDQUFDRyxZQUFZIiwic291cmNlcyI6WyIvVXNlcnMvcWVzbXNlcC9ub2lyLWNybS1kYXNoYm9hcmQvc3JjL2NvbnRleHQvQXBwQ29udGV4dC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgY3JlYXRlQ29udGV4dCwgdXNlU3RhdGUsIHVzZUNvbnRleHQsIHVzZUVmZmVjdCB9IGZyb20gXCJyZWFjdFwiO1xuaW1wb3J0IHsgc3VwYWJhc2UgfSBmcm9tIFwiLi4vcGFnZXMvYXBpL3N1cGFiYXNlQ2xpZW50XCI7XG5cbmNvbnN0IEFwcENvbnRleHQgPSBjcmVhdGVDb250ZXh0KG51bGwpO1xuXG5leHBvcnQgZnVuY3Rpb24gQXBwQ29udGV4dFByb3ZpZGVyKHsgY2hpbGRyZW4gfSkge1xuICBjb25zdCBbdXNlciwgc2V0VXNlcl0gPSB1c2VTdGF0ZShudWxsKTtcbiAgY29uc3QgW3Jlc2VydmF0aW9ucywgc2V0UmVzZXJ2YXRpb25zXSA9IHVzZVN0YXRlKFtdKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIC8vIENoZWNrIGZvciBleGlzdGluZyBzZXNzaW9uIG9uIG1vdW50XG4gICAgc3VwYWJhc2UuYXV0aC5nZXRTZXNzaW9uKCkudGhlbigoeyBkYXRhOiB7IHNlc3Npb24gfSB9KSA9PiB7XG4gICAgICBpZiAoc2Vzc2lvbj8udXNlcikgc2V0VXNlcihzZXNzaW9uLnVzZXIpO1xuICAgIH0pO1xuICAgIC8vIExpc3RlbiBmb3IgbG9naW4vbG9nb3V0XG4gICAgY29uc3QgeyBkYXRhOiBsaXN0ZW5lciB9ID0gc3VwYWJhc2UuYXV0aC5vbkF1dGhTdGF0ZUNoYW5nZSgoX2V2ZW50LCBzZXNzaW9uKSA9PiB7XG4gICAgICBzZXRVc2VyKHNlc3Npb24/LnVzZXIgfHwgbnVsbCk7XG4gICAgfSk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGxpc3RlbmVyPy5zdWJzY3JpcHRpb24/LnVuc3Vic2NyaWJlPy4oKTtcbiAgICB9O1xuICB9LCBbXSk7XG5cbiAgcmV0dXJuIChcbiAgICA8QXBwQ29udGV4dC5Qcm92aWRlciB2YWx1ZT17eyB1c2VyLCBzZXRVc2VyLCByZXNlcnZhdGlvbnMsIHNldFJlc2VydmF0aW9ucyB9fT5cbiAgICAgIHtjaGlsZHJlbn1cbiAgICA8L0FwcENvbnRleHQuUHJvdmlkZXI+XG4gICk7XG59XG5cbmV4cG9ydCBjb25zdCB1c2VBcHBDb250ZXh0ID0gKCkgPT4gdXNlQ29udGV4dChBcHBDb250ZXh0KTsgIl0sIm5hbWVzIjpbIlJlYWN0IiwiY3JlYXRlQ29udGV4dCIsInVzZVN0YXRlIiwidXNlQ29udGV4dCIsInVzZUVmZmVjdCIsInN1cGFiYXNlIiwiQXBwQ29udGV4dCIsIkFwcENvbnRleHRQcm92aWRlciIsImNoaWxkcmVuIiwidXNlciIsInNldFVzZXIiLCJyZXNlcnZhdGlvbnMiLCJzZXRSZXNlcnZhdGlvbnMiLCJhdXRoIiwiZ2V0U2Vzc2lvbiIsInRoZW4iLCJkYXRhIiwic2Vzc2lvbiIsImxpc3RlbmVyIiwib25BdXRoU3RhdGVDaGFuZ2UiLCJfZXZlbnQiLCJzdWJzY3JpcHRpb24iLCJ1bnN1YnNjcmliZSIsIlByb3ZpZGVyIiwidmFsdWUiLCJ1c2VBcHBDb250ZXh0Il0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(pages-dir-node)/./src/context/AppContext.js\n");

/***/ }),

/***/ "(pages-dir-node)/./src/pages/_app.tsx":
/*!****************************!*\
  !*** ./src/pages/_app.tsx ***!
  \****************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ MyApp)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _context_AppContext__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../context/AppContext */ \"(pages-dir-node)/./src/context/AppContext.js\");\n/* harmony import */ var _components_MainNav__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../components/MainNav */ \"(pages-dir-node)/./src/components/MainNav.tsx\");\n/* harmony import */ var next_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! next/router */ \"(pages-dir-node)/./node_modules/next/router.js\");\n/* harmony import */ var next_router__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(next_router__WEBPACK_IMPORTED_MODULE_3__);\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_components_MainNav__WEBPACK_IMPORTED_MODULE_2__]);\n_components_MainNav__WEBPACK_IMPORTED_MODULE_2__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];\n\n\n\n\nfunction MyApp({ Component, pageProps }) {\n    const router = (0,next_router__WEBPACK_IMPORTED_MODULE_3__.useRouter)();\n    const hideNav = router.pathname.startsWith('/admin') || router.pathname === '/auth/admin';\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_context_AppContext__WEBPACK_IMPORTED_MODULE_1__.AppContextProvider, {\n        children: [\n            !hideNav && /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_components_MainNav__WEBPACK_IMPORTED_MODULE_2__[\"default\"], {}, void 0, false, {\n                fileName: \"/Users/qesmsep/noir-crm-dashboard/src/pages/_app.tsx\",\n                lineNumber: 12,\n                columnNumber: 20\n            }, this),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n                ...pageProps\n            }, void 0, false, {\n                fileName: \"/Users/qesmsep/noir-crm-dashboard/src/pages/_app.tsx\",\n                lineNumber: 13,\n                columnNumber: 7\n            }, this)\n        ]\n    }, void 0, true, {\n        fileName: \"/Users/qesmsep/noir-crm-dashboard/src/pages/_app.tsx\",\n        lineNumber: 11,\n        columnNumber: 5\n    }, this);\n}\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHBhZ2VzLWRpci1ub2RlKS8uL3NyYy9wYWdlcy9fYXBwLnRzeCIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUEyRDtBQUNmO0FBRUo7QUFFekIsU0FBU0csTUFBTSxFQUFFQyxTQUFTLEVBQUVDLFNBQVMsRUFBWTtJQUM5RCxNQUFNQyxTQUFTSixzREFBU0E7SUFDeEIsTUFBTUssVUFBVUQsT0FBT0UsUUFBUSxDQUFDQyxVQUFVLENBQUMsYUFBYUgsT0FBT0UsUUFBUSxLQUFLO0lBRTVFLHFCQUNFLDhEQUFDUixtRUFBa0JBOztZQUNoQixDQUFDTyx5QkFBVyw4REFBQ04sMkRBQU9BOzs7OzswQkFDckIsOERBQUNHO2dCQUFXLEdBQUdDLFNBQVM7Ozs7Ozs7Ozs7OztBQUc5QiIsInNvdXJjZXMiOlsiL1VzZXJzL3Flc21zZXAvbm9pci1jcm0tZGFzaGJvYXJkL3NyYy9wYWdlcy9fYXBwLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBDb250ZXh0UHJvdmlkZXIgfSBmcm9tICcuLi9jb250ZXh0L0FwcENvbnRleHQnO1xuaW1wb3J0IE1haW5OYXYgZnJvbSAnLi4vY29tcG9uZW50cy9NYWluTmF2JztcbmltcG9ydCB0eXBlIHsgQXBwUHJvcHMgfSBmcm9tICduZXh0L2FwcCc7XG5pbXBvcnQgeyB1c2VSb3V0ZXIgfSBmcm9tICduZXh0L3JvdXRlcic7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIE15QXBwKHsgQ29tcG9uZW50LCBwYWdlUHJvcHMgfTogQXBwUHJvcHMpIHtcbiAgY29uc3Qgcm91dGVyID0gdXNlUm91dGVyKCk7XG4gIGNvbnN0IGhpZGVOYXYgPSByb3V0ZXIucGF0aG5hbWUuc3RhcnRzV2l0aCgnL2FkbWluJykgfHwgcm91dGVyLnBhdGhuYW1lID09PSAnL2F1dGgvYWRtaW4nO1xuXG4gIHJldHVybiAoXG4gICAgPEFwcENvbnRleHRQcm92aWRlcj5cbiAgICAgIHshaGlkZU5hdiAmJiA8TWFpbk5hdiAvPn1cbiAgICAgIDxDb21wb25lbnQgey4uLnBhZ2VQcm9wc30gLz5cbiAgICA8L0FwcENvbnRleHRQcm92aWRlcj5cbiAgKTtcbn0gIl0sIm5hbWVzIjpbIkFwcENvbnRleHRQcm92aWRlciIsIk1haW5OYXYiLCJ1c2VSb3V0ZXIiLCJNeUFwcCIsIkNvbXBvbmVudCIsInBhZ2VQcm9wcyIsInJvdXRlciIsImhpZGVOYXYiLCJwYXRobmFtZSIsInN0YXJ0c1dpdGgiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(pages-dir-node)/./src/pages/_app.tsx\n");

/***/ }),

/***/ "(pages-dir-node)/./src/pages/api/supabaseClient.js":
/*!*****************************************!*\
  !*** ./src/pages/api/supabaseClient.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   supabase: () => (/* binding */ supabase)\n/* harmony export */ });\n/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @supabase/supabase-js */ \"@supabase/supabase-js\");\n/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__);\n\nconst supabaseUrl = \"https://hkgomdqmzideiwudkbrz.supabase.co\";\nconst supabaseKey = \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZ29tZHFtemlkZWl3dWRrYnJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1OTk5ODMsImV4cCI6MjA2MzE3NTk4M30.WP-CFyMpfaDlVk-ZcSja_CFVNDz9u6IAIyICrhnLP8k\";\nif (!supabaseUrl || !supabaseKey) {\n    throw new Error('Missing Supabase environment variables');\n}\nconst supabase = (0,_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_0__.createClient)(supabaseUrl, supabaseKey);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHBhZ2VzLWRpci1ub2RlKS8uL3NyYy9wYWdlcy9hcGkvc3VwYWJhc2VDbGllbnQuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQXFEO0FBRXJELE1BQU1DLGNBQWNDLDBDQUFvQztBQUN4RCxNQUFNRyxjQUFjSCxrTkFBeUM7QUFFN0QsSUFBSSxDQUFDRCxlQUFlLENBQUNJLGFBQWE7SUFDaEMsTUFBTSxJQUFJRSxNQUFNO0FBQ2xCO0FBRU8sTUFBTUMsV0FBV1IsbUVBQVlBLENBQUNDLGFBQWFJLGFBQWEiLCJzb3VyY2VzIjpbIi9Vc2Vycy9xZXNtc2VwL25vaXItY3JtLWRhc2hib2FyZC9zcmMvcGFnZXMvYXBpL3N1cGFiYXNlQ2xpZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNyZWF0ZUNsaWVudCB9IGZyb20gJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcyc7XG5cbmNvbnN0IHN1cGFiYXNlVXJsID0gcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfU1VQQUJBU0VfVVJMO1xuY29uc3Qgc3VwYWJhc2VLZXkgPSBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19TVVBBQkFTRV9BTk9OX0tFWTtcblxuaWYgKCFzdXBhYmFzZVVybCB8fCAhc3VwYWJhc2VLZXkpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIFN1cGFiYXNlIGVudmlyb25tZW50IHZhcmlhYmxlcycpO1xufVxuXG5leHBvcnQgY29uc3Qgc3VwYWJhc2UgPSBjcmVhdGVDbGllbnQoc3VwYWJhc2VVcmwsIHN1cGFiYXNlS2V5KTsgIl0sIm5hbWVzIjpbImNyZWF0ZUNsaWVudCIsInN1cGFiYXNlVXJsIiwicHJvY2VzcyIsImVudiIsIk5FWFRfUFVCTElDX1NVUEFCQVNFX1VSTCIsInN1cGFiYXNlS2V5IiwiTkVYVF9QVUJMSUNfU1VQQUJBU0VfQU5PTl9LRVkiLCJFcnJvciIsInN1cGFiYXNlIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(pages-dir-node)/./src/pages/api/supabaseClient.js\n");

/***/ }),

/***/ "@chakra-ui/react":
/*!***********************************!*\
  !*** external "@chakra-ui/react" ***!
  \***********************************/
/***/ ((module) => {

module.exports = import("@chakra-ui/react");;

/***/ }),

/***/ "@supabase/supabase-js":
/*!****************************************!*\
  !*** external "@supabase/supabase-js" ***!
  \****************************************/
/***/ ((module) => {

module.exports = require("@supabase/supabase-js");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ "next/dist/compiled/next-server/pages.runtime.dev.js":
/*!**********************************************************************!*\
  !*** external "next/dist/compiled/next-server/pages.runtime.dev.js" ***!
  \**********************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/pages.runtime.dev.js");

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

module.exports = require("react");

/***/ }),

/***/ "react-dom":
/*!****************************!*\
  !*** external "react-dom" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("react-dom");

/***/ }),

/***/ "react/jsx-dev-runtime":
/*!****************************************!*\
  !*** external "react/jsx-dev-runtime" ***!
  \****************************************/
/***/ ((module) => {

module.exports = require("react/jsx-dev-runtime");

/***/ }),

/***/ "react/jsx-runtime":
/*!************************************!*\
  !*** external "react/jsx-runtime" ***!
  \************************************/
/***/ ((module) => {

module.exports = require("react/jsx-runtime");

/***/ }),

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("zlib");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/@swc"], () => (__webpack_exec__("(pages-dir-node)/./src/pages/_app.tsx")));
module.exports = __webpack_exports__;

})();