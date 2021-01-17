$(function() {
  let $contact = $('#contact-template');
  let $contactLayout = $('#contact-layout');
  let $createContactForm = $('#create-contact-form');
  let $editContactForm = $('#edit-contact-form');
  let $filterTagsList = $('.filter-tags-list');
  let $contacts = $('.contacts');
  let $main = $('main');
  let contactTemplate = Handlebars.compile($contact.html());
  let contactLayoutTemplate = Handlebars.compile($contactLayout.html());
  Handlebars.registerPartial('contactTemplate', $contact.html());
  let timeout = true;
  let currentEditContactId;
  let filterTags = [];
  

  let clientStore;


  let validationTable = {
    full_name(input) {
      if (input.trim() === '') {
        return 'Full name is a required field';
      } else {
        return '';
      }
    },
    email(input) {
      if (input.match(/^\w+@.+\.\w+$/)) {
        return '';
      } else {
        return 'Please enter a valid email';
      }
    },
    phone_number(input) {
      if (input.match(/^\d+$/)) {
        return '';
      } else {
        return 'Please enter a valid phone number';
      }
    },
    tags(input) {
      if (input.trim() === '') {
        return '';
      }
      let tagsArr = input.split(',').map(tag => tag.trim());
      let currentTags = {};
      for (let i = 0; i < tagsArr.length; i++) {
        let tag = tagsArr[i];
        if (tag.length > 0 && !currentTags[tag]) {
          currentTags[tag] = true;
        } else {
          return 'Tags may not be empty or be duplicated!';
        }
      }
      return '';
    }
  }

  // helper functions
  function processContact(contact) {
    if (contact.tags) {
      contact.tags = contact.tags.split(',').map(tag => tag.trim());
    }
  }

  function displayError($form, name, errorMessage) {

    let $input = $form.find(`[name="${name}"]`);
    console.log(errorMessage)
    console.log($input);
    $input.next().text(errorMessage);
    $input.addClass('input-error');
    $input.parent().prev().addClass('label-error');
  }

  function hideError($form, name) {
    let $input = $form.find(`[name="${name}"]`);
    $input.next().text('');
    $input.removeClass('input-error');
    $input.parent().prev().removeClass('label-error');
  }

  function hideAllErrors($form) {
    $form.find('.input-error').removeClass('input-error');
    $form.find('.label-error').removeClass('label-error');
    $form.find('.invalid').text('');
  }

  function convertToJson(formData) {
    let json = {};
    formData = [...formData];
    console.log(formData);
    formData.forEach(pair => {
      json[pair[0]] = pair[1];
    });
    return JSON.stringify(json);
  }

  function validateForm($form, formData) {
    let pairs = [...formData];
    let valid = true;
    pairs.forEach(pair => {
      let name = pair[0];
      let value = pair[1];
      let validationResult = validationTable[name](value);
      if (validationResult === '') {
        hideError($form, name);
      } else {
        valid = false;
        displayError($form, name, validationResult);
      }
    });
    return valid;
  }

  function addNewContact(result) {
    console.log(result);
    let renderedContact = contactTemplate(result);
    $('.contacts-list').append(renderedContact);
  }

  function onContactCreated(result) {
    clientStore.push(result);
    addNewContact(result);
    $createContactForm.hide();
    $main.show();
  }

  function onContactEdited(result) {
    let contact = clientStore.find(contact => contact.id === Number(currentEditContactId));
    let index = clientStore.indexOf(contact);
    clientStore[index] = result;
    let $currentContact = $('.contacts-list').find(`#${currentEditContactId}`);
    processContact(result);
    let $newContact = $(contactTemplate(result));
    $newContact.insertAfter($currentContact);
    $currentContact.remove();
    $editContactForm.hide();
    $main.show();
    console.log(result);
    console.log(clientStore);
  }

  function onContactDeleted(id) {
    let contact = clientStore.find(contact => contact.id === Number(id));
    let index = clientStore.indexOf(contact);
    clientStore.splice(index, 1);
    $('.contacts-list').find(`#${id}`).remove();
  }

  // event handlers
  function filterContacts(event) {
    event.preventDefault();
    if (timeout) {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        let searchText = $(event.target).val();
        let $contacts = $('.contact');
        if (searchText !== '') {
          $contacts.each((idx, contact) => {
            let $contact = $(contact);
            let name = $contact.find('.full_name').text().toLowerCase();
            if (name.indexOf(searchText) === -1) {
              $contact.hide();
            } else {
              $contact.show();
            }
          });
        } else {
          $contacts.each((idx, contact) => {
            let $contact = $(contact);
            $contact.show();
          });
        }
      }, 200);
    };
  }


  function filterContactsByTag() {
    clientStore.forEach(contact => {
      let tags = contact.tags;
      let id = contact.id;
      let $contact = $('.contacts-list').find(`#${id}`);
      if (filterTags.length === 0) {
        $contact.show();
      } else if (tags && filterTags.every(filterTag => tags.indexOf(filterTag) > -1)) {
        $contact.show();
      } else {
        $contact.hide();
      }
    });

  }

  function addFilterTag(tag) {
    if (filterTags.indexOf(tag) > -1) {return};
    filterTags.push(tag);
    let $li = $('<li></li>').text(tag).addClass('filter-tag');
    $li.on('click', event => {
      removeFilterTag(tag, $li);
    });
    $filterTagsList.append($li);
    filterContactsByTag();
  }

  function removeFilterTag(tag, $li) {
    $li.remove();
    filterTags.splice(filterTags.indexOf(tag), 1);
    filterContactsByTag();
  }

  function renderCreateForm(event) {
    event.preventDefault();
    $createContactForm.show();
    $main.hide();
  }
  
  function renderEditForm(event) {
    $editContactForm.show();
    $main.hide();
    let $target = $(event.target);

    let id = $target.closest('li').attr('id');
    currentEditContactId = id;
    let contactData = clientStore.find(contact => contact.id === Number(id));
    for (let prop in contactData) {
      let $input = $editContactForm.find(`[name="${prop}"]`);
      $input.val(contactData[prop]);
    }
  }

  

  function deleteContact(event) {
    let id = $(event.target).closest('.contact').attr('id');
    let response = confirm("Do you want to delete the contact?");
    if (!response) {return};
    $.ajax({
      url: `/api/contacts/${id}`,
      type: 'DELETE',
      success: function(result) {
        onContactDeleted(id);
      }
    });
  }

  function onEditCancel(event) {
    $editContactForm.hide();
    $main.show();
    let $form = $(event.target).closest('form');
    hideAllErrors($form);
  }

  function onCreateCancel(event) {
    $createContactForm.hide();
    $main.show();
    let $form = $(event.target).closest('form');
    hideAllErrors($form);
  }

  function onClick(event) {
    event.preventDefault();
    let $target = $(event.target);
    if ($target.hasClass('edit')) {
      renderEditForm(event);
    } else if ($target.hasClass('delete')) {
      deleteContact(event);
    } else if ($target.hasClass('tag')) {
      addFilterTag($(event.target).text());
      
    }
  }

  function onCreateSubmit(event) {
    event.preventDefault();
    let $form = $(event.target);

    let formData = new FormData($form[0]);
    let formValid = validateForm($form, formData);
    if (formValid) {
      let json = convertToJson(formData);
      console.log(json);
      // $.post('/api/contacts', json, function(data) {

      //   console.log(data);
      // });
      
      // let xhr = new XMLHttpRequest();
      // xhr.open('POST', '/api/contacts');
      // xhr.setRequestHeader('Content-Type', 'application/json');
      // xhr.addEventListener('load', event => {
      //   console.log(xhr.response);
      // });
      // xhr.send(json);
    }
  }

  function onEditSubmit(event) {
    event.preventDefault();
    let $form = $(event.target);

    let formData = new FormData($form[0]);
    let formValid = validateForm($form, formData);
    if (formValid) {
      let json = convertToJson(formData);
      $.ajax({
        method: 'PUT',
        url: `/api/contacts/${currentEditContactId}`,
        data: json,
        contentType: 'application/json',
        success(result) {
          onContactEdited(result);
        }
      });
    }
  }

  // init
  $contact.remove();
  $contactLayout.remove();
  $editContactForm.hide();
  $createContactForm.hide();
  let $contactsList = $('.contacts-list');
  function getContacts() {
    $.get('/api/contacts', function(data) {
      data.forEach(processContact);
      clientStore = data;
      let contactLayout = contactLayoutTemplate(data);
      $contacts.html(contactLayout);
    });
  }
  getContacts();
  $('#create-contact').on('click', renderCreateForm);
  $('.search').on('keyup', filterContacts);
  $contacts.on('click', onClick);
  $createContactForm.find('input[type=button]').on('click', onCreateCancel);
  $editContactForm.find('input[type=button]').on('click', onEditCancel);
  $createContactForm.on('submit', onCreateSubmit);
  $editContactForm.on('submit', onEditSubmit);
  
  
});