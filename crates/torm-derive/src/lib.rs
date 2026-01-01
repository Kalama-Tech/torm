//! TORM derive macro for Model trait

use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, Data, DeriveInput, Fields};

/// Derive the Model trait for a struct
///
/// # Example
/// ```rust,ignore
/// #[derive(Model, Serialize, Deserialize)]
/// struct User {
///     #[id]
///     id: String,
///     name: String,
///     email: String,
/// }
/// ```
#[proc_macro_derive(Model, attributes(id, collection))]
pub fn derive_model(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);

    let name = &input.ident;
    let collection_name = name.to_string().to_lowercase();

    // Find the field marked with #[id]
    let id_field = find_id_field(&input.data);

    let id_field_name = match id_field {
        Some(field) => field,
        None => {
            return syn::Error::new_spanned(name, "Model must have a field marked with #[id]")
                .to_compile_error()
                .into();
        }
    };

    let expanded = quote! {
        #[async_trait::async_trait]
        impl torm::Model for #name {
            fn collection() -> &'static str {
                #collection_name
            }

            fn id(&self) -> &str {
                &self.#id_field_name
            }

            fn set_id(&mut self, id: String) {
                self.#id_field_name = id;
            }
        }
    };

    TokenStream::from(expanded)
}

fn find_id_field(data: &Data) -> Option<syn::Ident> {
    match data {
        Data::Struct(data_struct) => {
            if let Fields::Named(fields) = &data_struct.fields {
                for field in &fields.named {
                    // Check if field has #[id] attribute
                    for attr in &field.attrs {
                        if attr.path().is_ident("id") {
                            return field.ident.clone();
                        }
                    }
                }
            }
        }
        _ => return None,
    }
    None
}
